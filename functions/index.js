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


//saving images on Cloud Storage

const { createWriteStream } = require("fs");                                                                                                    
const { Storage } = require("@google-cloud/storage");
const path = require("path");


//[Start Register user in database]
exports.registerUser =  functions.auth.user().onCreate((user)=>{
 // const email = user.email;
 // const name = user.displayName;
 // const userId = user.uid;
  //const phone = user.phoneNumber;
  //return createStripeCustomer(name,email,userId);
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
  console.log(JSON.stringify(data));
  const newRegister = await deliveries.doc(data.deliveryid).set({
  	client: data.client,
  	destination:  new admin.firestore.GeoPoint(parseFloat(data.destination.lat),parseFloat(data.destination.lng)),
	location: null,
	restaurant: data.restaurant,
  	state: 0,
	reference: data.reference,
	owner: data.owner,
	items: data.items,
	driver: null,
	restaurantLocation: new admin.firestore.GeoPoint(parseFloat(data.restaurantLocation.lat),parseFloat(data.restaurantLocation.lng)),
	restaurantName: data.restaurantName,
	price: data.price,
	type: 0
  });
  return newRegister; 
}
//
//[Create Delivey End]

//[Create JOB START]
exports.createJobForDriver = functions.firestore.document('/deliveries/{deliveryid}').onUpdate(async (change,context)=>{
	const after = change.after.data();
	if(parseInt(after.state) === 3 && (after.driver === undefined || after.driver === "" || after.driver === null)){
	  //let newData = await createJob({id:context.params.deliveryid,...after});
	  return assignDeliveryOnDriver({id:context.params.deliveryid,...after})
	}
});

async function assignDeliveryOnDriver(data){
  const database = admin.firestore();
  let driverId;
  const jobs = await database.collection('drivers').where('deliveryId','==',null).where('active','==',true).limit(1).get();
  if(jobs.empty){
	console.log('No matching results')
  }
  else{
     jobs.forEach(job =>{
	driverId = job.id;
  	console.log(JSON.stringify(job.id))
     });
     await database.collection('deliveries').doc(data.id).update({
	     driver: driverId
     });

     await database.collection('drivers').doc(driverId).update({
	     deliveryId: data.id
     });
	return jobs;
 }

}

async function createJob(data){
  const database = admin.firestore();
  const jobs = await database.collection('jobs');
  const newJob = await jobs.doc(data.id).set({
	  restaurant: data.restaurant,
	  location: new admin.firestore.GeoPoint(parseFloat(13.707601), parseFloat(-89.236493)),
  });
  return newJob;
}
//[CREATE JOB END]

//[CREATE DRIVER START]
exports.createDriver = functions.https.onRequest((req,res)=>{
  return cors(req,res,async ()=>{ 
	console.log(JSON.stringify(req.body))
	let newDriver = await createDriver({email: req.body.email,name: req.body.name, password: generatePassword()})
	res.status(200).send(JSON.stringify({...newDriver}))
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
	console.log(`Data driver ${JSON.stringify(data)}`)
    await admin.auth().createUser({
     email: data.email,
     displayName: data.name,
     emailVerified: true,
     password: data.password
  }).then(async (user)=>{
	console.log(JSON.stringify(user))
	newUser = user;
	await claimForDriver(newUser.uid);
	await createDriverOnCollection({driverId: newUser.uid,location:''})
  });
  return newUser;
}

async function claimForDriver(id){
   
   let done = false;
   await admin.auth().setCustomUserClaims(id,{driver:true}).then(()=>{
	console.log('Se agrego un permiso de driver');
	done = true;
   });
}
//[CREATE DRIVER END]

//[ASSIGN DRIVER TO JOB START]
exports.assignDriverToJob = functions.firestore.document('jobs/{jobid}').onCreate(async (job,context)=>{
  const database = admin.firestore();
  const data = await database.collection('drivers').get();
  data.docs.map(doc => {console.log(JSON.stringify(doc.id))});
  data.docs.forEach((value,key)=>{
	if(value.deliveryId === null){
		console.log(key)
	}
  });
});
//[ASSIGN DRIVER TO JOB END]

//[CREATE DRIVER DOCUMENT START]
exports.createDriversDocument = functions.https.onRequest((req,res)=>{
  return cors(req,res, async ()=>{
	let newCollection = await createDriverOnCollection(req.body);
	res.status(200).send(JSON.stringify(newCollection))
  })
});


async function createDriverOnCollection(data){
  const database = admin.firestore();
  const drivers = await database.collection('drivers');
  const newRegister = await drivers.doc(data.driverId).set({
	location: null,
	deliveryId:null,
	active:false,
	jobAccepted:false
  });
  return newRegister; 
}
//[CREATE DRIVER DOCUMENT END]

//[Create Restaurant owner Start]
exports.createRestaurantOwner = functions.https.onRequest((req,res)=>{
  return cors(req,res,async ()=>{
	let newUser = await createRestaurantOwner({uid: req.body.uid,email:req.body.email,password:generatePassword()});
	console.log(`VAMOS A IMPRIMIR DATA ${JSON.stringify(newUser)}`)
	res.status(200).send(JSON.stringify({...newUser}));
  });
});

async function createRestaurantOwner(data){
  let newUser = await admin.auth().createUser({
     uid: data.uid,
     email: data.email,
     password: data.password
  });
  claimForRestaurantOwner(newUser.uid);
  return newUser;
}

async function claimForRestaurantOwner(id){
   let done = false;
   admin.auth().setCustomUserClaims(id,{restaurant:true}).then(()=>{
	console.log('restaurant owner added');
	done = true;
   });
}

//Start delete driver

exports.deleteDriver = functions.https.onRequest((req,res)=>{
  return cors(req,res,async ()=>{
	console.log(JSON.stringify(req.body))
	let response = await deleteDriver(req.body.id);
	if(!response){
	  res.status(201).send(JSON.stringify({response:false}));
	}else{
	  res.status(200).send(JSON.stringify({response: true}));
	}
  });
});

async function deleteDriver(id){
  let response = false;
   await admin.auth().deleteUser(id).then(()=>{
	console.log(`USER DELETED`)
	response = true;
  }); 
  return response;
}
