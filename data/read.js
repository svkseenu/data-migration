// // Sample JSON format

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const axios = require("axios");
const FormData = require('form-data');
var path = require("path");
const url = process.env.MONGO_URL;

const auth0MMToken = async () => {
    console.log(`auth0 M2M data start `);
    var data = JSON.stringify({
        "client_id": process.env.AUTH0_M2M_CLIENT_ID,
        "client_secret": process.env.AUTH0_M2M_CLIENT_SECRET,
        "audience": `https://${process.env.AUTH0_AUDIENCE}/api/v2/`,
        "grant_type": 'client_credentials'
    });
    // console.log(`auth0 M2M access token request ${JSON.stringify(data)}`);

    var config = {
        method: 'post',
        url: `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
        headers: {
            'Content-Type': 'application/json',
        },
        data: data
    };

    const token = await axios(config)
        .then((response) => {
            console.log(`auth0 M2M access token ${response.data.access_token}`);
            return response.data.access_token;
        })
        .catch((error) => {
            console.log(`auth0 M2M error ${error} `);

        });
    console.log(`auth0 M2M data end `);

    return token;


};

const readAndWriteData = async () => {
    try {

        console.log("readAndWriteData start");
        MongoClient.connect(url, (err, db) => {
            if (err) throw err;
            var dbo = db.db(process.env.MONGO_DB);
            var query = {};// { tenants: ObjectId('5f3cfe57392874001302a8a2') };
            var JsonData = [];
            dbo.collection(process.env.MONGO_COLLECTION).find(query).toArray((err, result) => {
                if (err) throw err;
                // console.log(result);
                result.forEach((val) => {
                    // console.log("user email ", val._id);
                    // JsonData.push(val._id);
                    JsonData.push({
                        user_id: val._id, email: val.email, email_verified: true, custom_password_hash: {
                            algorithm: "argon2",
                            hash: {
                                value: val.password
                            }
                        },
                        user_metadata:{"tenantId":"5f3cfe57392874001302a8a2"}
                    });
                })
                var JsonDataString = JSON.stringify(JsonData);
                fs.writeFile('e5auth0user.json', JsonDataString, 'utf8', (err) => {
                    if (err) {
                        console.log(err);
                    }
                    else {
                        console.log("File written successfully\n");
                        console.log("readAndWriteData end");
                        // executeJob(JsonData);
                         auth0MMToken();

                    }
                });
                db.close();
            });
        });
    } catch (e) {
        console.error(e)
    }
}

const executeJob = async (JsonData) => {
    console.log("executeJob start");

    var data = new FormData();
    data.append('users', fs.createReadStream(path.resolve("./e5auth0user.json")));
    data.append('connection_id', 'con_NImLaJzZKuXp7O3T');
    data.append('upsert', 'false');
    data.append('external_id', '12e13');
    data.append('send_completion_email', 'false');

    const token = await auth0MMToken();
    if (!token) {
        throw new BadRequest(
            'Invalid Mangement API Token'
        );
    }
    var options = {
        method: 'POST',
        url: `https://${process.env.AUTH0_DOMAIN}/api/v2/jobs/users-imports`,
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'multipart/form-data',
            ...data.getHeaders()
        },
        data: data
    };
    var options = {
        method: 'POST',
        url: `https://${process.env.AUTH0_DOMAIN}/api/v2/jobs/users-imports`,
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'multipart/form-data',
            ...data.getHeaders()
        },
        data: data
    };

    await axios(options)
        .then((res) => {
            // console.log(" res obj job ", res.data);
            let intervalID;
            let jobStatus = { status: "pending" };
            intervalID = setInterval(() => {
                jobStatus = checkJobStatus(token, res.data.id, intervalID, JsonData);
            }, 2000);
            // console.log(" status ", jobStatus);

            // console.log(" job status finished");
            return res.data;
        })
        .catch((error) => {
            console.error(error);
        });
    // console.log(" job res ", jobRes);
    console.log("executeJob end");
}

const checkJobStatus = async (token, jobId, intervalID, JsonData) => {
    console.log("checkJobStatus start");

    var options = {
        method: 'GET',
        url: `https://${process.env.AUTH0_DOMAIN}/api/v2/jobs/${jobId}`,

        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`
        }
    };

    await axios(options).then((res) => {
        // console.log(" res job status  ", res.data);
        if (res.data.status === "completed" || res.data.status === "failed") {
            clearInterval(intervalID);
            console.log("checkJobStatus end");
            getStatus(token, res.data, JsonData);
        }
    }).catch((error) => {
        console.error(error);
    });
}

const getStatus = async (token, res, JsonData) => {
    console.log("getStatus start");

    if (res.summary.failed > 0) {
        var options = {
            method: 'GET',
            url: `https://${process.env.AUTH0_DOMAIN}/api/v2/jobs/${res.id}/errors`,
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${token}`
            }
        };

        await axios(options).then((res) => {
            return res.data;
        }).then((data) => {
            console.log("err ", JSON.stringify(data));
            console.log(" data ", JSON.stringify(JsonData));
            const resultOb = JsonData.filter((testItem) =>
                !data.find((errItem) => testItem.email.toLowerCase() == errItem.user.email.toLowerCase()));
            console.log("getStatus end");
            updateIsAuth0(resultOb);
        }).catch((error) => {
            console.error(error);
        });

    } else {
        console.log("getStatus end");
        updateIsAuth0(JsonData);
    }
}

const updateIsAuth0 = async (updatedUsersList) => {
    console.log("updateIsAuth0 start");
    console.log("Filtered Object  ",updatedUsersList);

    MongoClient.connect(url, (err, db) => {
        if (err) throw err;
        var dbo = db.db(process.env.MONGO_DB);
        updatedUsersList.forEach((obj) => {
            dbo.collection(process.env.MONGO_COLLECTION).updateOne({ _id: obj.user_id }, { $set: { is_auth0: true } });
        });
    });
    console.log("updateIsAuth0 End");


}

module.exports = { readAndWriteData, executeJob };