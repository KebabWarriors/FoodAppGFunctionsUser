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


const Stripe = require("stripe");
const stripe = Stripe("sk_test_51H4UivJ0n1vUgoZKN5bPsWmydn1JBhAjNxVc9tr66z8bt9p1OGL235Tw3ES5VOnFwmV8gbm7CswljnjoHvOxRF5C00qmuVjfJ6");

// Configure the email transport using the default SMTP transport and a GMail account.
// For Gmail, enable these:
// 1. https://www.google.com/settings/security/lesssecureapps
// 2. https://accounts.google.com/DisplayUnlockCaptcha
// For other types of transports such as Sendgrid see https://nodemailer.com/transports/
// TODO: Configure the `gmail.email` and `gmail.password` Google Cloud environment variables.
const gmailEmail = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

// Your company name to include in the emails
// TODO: Change this to your app or company name to customize the email sent.
const APP_NAME = 'Biite';

// [START sendWelcomeEmail]
/**
 * Sends a welcome email to new user.
 */
// [START onCreateTrigger]
exports.sendWelcomeEmail = functions.auth.user().onCreate((user) => {
// [END onCreateTrigger]
  // [START eventAttributes]
  const email = user.email; // The email of the user.
  const displayName = user.displayName; // The display name of the user.
  // [END eventAttributes]

  return sendWelcomeEmail(email, displayName);
});

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
exports.sendByeEmail = functions.auth.user().onDelete((user) => {
// [END onDeleteTrigger]
  const email = user.email;
  const displayName = user.displayName;
  const phone = user.phoneNumber;
  return sendGoodbyeEmail(email, displayName);
});
// [END sendByeEmail]

// Sends a welcome email to the given user.
async function sendWelcomeEmail(email, displayName) {
  const mailOptions = {
    from: `${APP_NAME} <noreply@firebase.com>`,
    to: email,
  };

  // The user subscribed to the newsletter.
  mailOptions.subject = `Welcome to ${APP_NAME}!`;
  mailOptions.text = `Hey ${displayName || ''}! Welcome to ${APP_NAME}. I hope you will enjoy our service.`;
  await mailTransport.sendMail(mailOptions);
  console.log('New welcome email sent to:', email);
  return null;
}

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

// Sends a goodbye email to the given user.
async function sendGoodbyeEmail(email, displayName) {
  const mailOptions = {
    from: `${APP_NAME} <noreply@firebase.com>`,
    to: email,
  };

  // The user unsubscribed to the newsletter.
  mailOptions.subject = `Bye!`;
  mailOptions.text = `Hey ${displayName || ''}!, We confirm that we have deleted your ${APP_NAME} account.`;
  await mailTransport.sendMail(mailOptions);
  console.log('Account deletion confirmation email sent to:', email);
  return null;
}

exports.verify = functions.https.onRequest((req, res)=>{
  return cors(req,res,()=>{
    const app = admin.initializeApp();
    let uid = null;
    admin.auth().verifyIdToken(idToken)
  	.then(function(decodedToken) {
    	 uid = decodedToken.uid;
    	
    	}).catch(function(error) {
    	// Handle error
	  console.log(error);
	});
      res.status(200).send(uid);
    });
});
