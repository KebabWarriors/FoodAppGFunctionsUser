const functions = require('firebase-functions');
const admin = require('firebase-admin');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
const nodemailer = require('nodemailer');
const neo4j  =  require("neo4j-driver");

const driver = neo4j.driver(
   `bolt://3.248.198.172:7687`,
   neo4j.auth.basic(`neo4j`, 'Fuckthisshit$1'),
   { disableLosslessIntegers: true }
);

const express = require('express');
const cors = require('cors')({
  origin: true
});


const app = admin.initializeApp();
const Stripe = require("stripe");
const stripe = Stripe("sk_test_51H4UivJ0n1vUgoZKN5bPsWmydn1JBhAjNxVc9tr66z8bt9p1OGL235Tw3ES5VOnFwmV8gbm7CswljnjoHvOxRF5C00qmuVjfJ6");

const { v4: uuidv4 } = require('uuid');


//[Start Register user in database]
exports.registerUser =  functions.auth.user().onCreate((user)=>{
  const email = user.email;
  const name = user.displayName;
  const userId = user.uid;
  const phone = user.phoneNumber;
  return createStripeCustomer(name,email,userId);
});

//[End Register user in database]
// [END sendWelcomeEmail]


// [START sendByeEmail]
/**
 * Send an account deleted email confirmation to users who delete their accounts.
 */
// [START onDeleteTrigger]

async function addUser(name,email,id,customer){
  const session = driver.session();
  let response = {};
  const setData = await session.run(`create (p:person{
	  id: $id,
	  email: $email, 
	  verified: true, 
	  type: 1,
	  customerId: $customerId
       }) return p`,{
	id: id,
	email: email,
	customerId: customer
  }).then((result) => {
	let response = result.records[0]._fields[0].properties;
  }).catch(error => console.log(JSON.stringify(error)));
  return response;
}

async function createStripeCustomer(name,email,id){
   let myCustomer;
   const customer = await stripe.customers.create({
       name: id
   }, (error, customer) =>
   {
     myCustomer = customer.id;
     console.log(customer.id);
     addUser(name,email,id,customer.id);
   }); 
   if(customer){
     return customer.id;
   }
   console.log(JSON.stringify(customer));
   return myCustomer;
}
//[Verify TOKEN START]
exports.verify = functions.https.onRequest((req, res)=>{
  return cors(req,res,async ()=>{
    let uid = null;
    console.log(req.body.token)
    const data = await admin.auth().verifyIdToken(req.body.token)
  	.then(function(decodedToken) {
	  console.log(decodedToken);
    	 return decodedToken.uid;
    	
    	}).catch(function(error) {
    	// Handle error
	  console.log(error);
	});
      console.log(`next to send`)
      console.log(data)
      res.status(200).send(JSON.stringify(data));
    });
});
//[Verify token END]

//[Get Deliveries Start]
exports.getDeliveries = functions.https.onRequest( (req,res)=>{
    getDeliveries();
    console.log("se supone que llegamos aqui");
    return cors(req,res,()=>{
     res.status(200).send("done");
    })
});

async function getDeliveries(){
  const database = admin.firestore();
  const data = await database.collection('deliveries').get();
  data.docs.map(doc => {console.log(doc.data())});
  return data;
}
//[Get Deliveries End]



//[Create Delivery START]
exports.createDelivery = functions.https.onRequest((req,res)=>{
  return cors(req,res,async ()=>{
	let newDelivery = await createDelivery(req.body);
	res.status(200).send(JSON.stringify(newDelivery));
  });
});

async function createDelivery(data){
  const database = admin.firestore();
  const deliveries = await database.collection('deliveries');
  const newRegister = await deliveries.doc(data.deliveryid).set({
  	client: data.client,
  	destination:  new admin.firestore.GeoPoint(parseFloat(data.destination.lat),parseFloat(data.destination.lng)),
	restaurant: data.restaurant,
  	state: 0,
	reference: data.reference
  });
  return newRegister; 
}
//[Create Delivey End]

//[Create JOB START]
exports.createJobForDriver = functions.firestore.document('/deliveries/{deliveryid}').onUpdate(async (change,context)=>{
	const after = change.after.data();
	if(parseInt(after.state) === 3){
	  let newData = await createJob({id:context.params.deliveryid,...after});
	}
	return "HEY:"
});

async function createJob(data){
  const database = admin.firestore();
  const jobs = await database.collection('jobs');
  const newJob = await jobs.doc(data.id).set({
	  restaurant: data.restaurant,
	  location: new admin.firestore.GeoPoint(parseFloat(43.473532), parseFloat(-3.785637)),
  });
  return newJob;
}
//[CREATE JOB END]

//[CREATE DRIVER START]
exports.createDriver = functions.https.onRequest((req,res)=>{
  return cors(req,res,async ()=>{ 
	let newDriver = await createDriver({email: req.body.email,name: req.body.name, password: generatePassword()})
	res.status(200).send(JSON.stringify(newDriver))
  });
});

function generatePassword(){
    let length = 2,
        charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*=+",
        charsetL = "abcdefghijklmnopqrstuvwxyz",
        charsetU = "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        charNumber = "1234567890",
        charSpecial = "!@#$%&*=+",
        retVal = "";
    for (let i = 0, n = charset.length; i < length; ++i) {
        retVal += charset.charAt(Math.floor(Math.random() * n));
    }
    for (let i = 0, n = charsetL.length; i < length; ++i) {
        retVal += charsetL.charAt(Math.floor(Math.random() * n));
    }
    for (let i = 0, n = charsetU.length; i < length; ++i) {
        retVal += charsetU.charAt(Math.floor(Math.random() * n));
    }
    for (let i = 0, n = charNumber.length; i < length; ++i) {
        retVal += charNumber.charAt(Math.floor(Math.random() * n));
    }
    for (let i = 0, n = charSpecial.length; i < length; ++i) {
        retVal += charSpecial.charAt(Math.floor(Math.random() * n));
    }
    return retVal;
  }

async function createDriver(data){
  let newUser = {};
   admin.auth().createUser({
     email: data.email,
     displayName: data.name,
     password: data.password
  }).then(async (user)=>{
	console.log(JSON.stringify(user))
	newUser = user;
	await claimForDriver(newUser.uid);
  });
  return newUser;
}

async function claimForDriver(id){
   
   let done = false;
   await admin.auth().setCustomUserClaims(id,{driver:true}).then(()=>{
	console.log('Se agrego un permiso de driver');
	done = true;
   });
   return done;
}
//[CREATE DRIVER END]

exports.assignDriverToJob = functions.firestore.document('jobs/{jobid}').onCreate(async (job,context)=>{
  const database = admin.firestore();
  const data = await database.collection('drivers').get();
  data.docs.map(doc => {console.log(JSON.stringify(doc.id))});
  /*data.docs.forEach((value,key)=>{
	value.data.
  });*/
});
