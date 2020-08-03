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


const cors = require('cors')({
  origin: true
});


const app = admin.initializeApp();
const Stripe = require("stripe");
const stripe = Stripe("sk_test_51H4UivJ0n1vUgoZKN5bPsWmydn1JBhAjNxVc9tr66z8bt9p1OGL235Tw3ES5VOnFwmV8gbm7CswljnjoHvOxRF5C00qmuVjfJ6");


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


exports.verify = functions.https.onRequest((req, res)=>{
  return cors(req,res,()=>{
    let uid = null;
    admin.auth().verifyIdToken(req.body.token)
  	.then(function(decodedToken) {
    	 uid = decodedToken.uid;
    	
    	}).catch(function(error) {
    	// Handle error
	  console.log(error);
	});
      res.status(200).send(uid);
    });
});

exports.getDeliveries = functions.https.onRequest((req,rest)=>{
  return cors(req,res,async()=>{
	const database = admin.firestore();
	const data = await db.collection('deliveries').get();
	data.forEach((doc)=>{
	  console.log(doc.id,' = ',doc.data());
	});
  })
});
