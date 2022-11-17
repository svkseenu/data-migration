const express = require('express');
require('dotenv').config();
 const app = express();
const {readAndWriteData} = require('./data/read');

// const readEnv = async () => {
//   console.log("env started read env ",process.env.EXPIRY_NOTIFICATION_DAYS);
//   const envArray = process.env.EXPIRY_NOTIFICATION_DAYS.split(",");
//   console.log(" array val ",envArray);
//   const dateArray = [];
//   envArray.forEach((e)=>{
//     let test =new Date (new Date(new Date().setDate(new Date().getDate() +  parseInt(e))));
//     console.log(" testtttttt ",test.getFullYear()+"-"+test.getMonth()+"-"+test.getDate());
//    })
//   console.log(" date array val ",dateArray);
// }

app.listen(3000, async() =>{
 await readAndWriteData();
});