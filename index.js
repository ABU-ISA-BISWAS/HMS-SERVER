const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const res = require('express/lib/response');
const query = require('express/lib/middleware/query');
const port = process.env.PORT || 5000 ;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xhgug.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req,res,next){
const authHeader = req.headers.authorization;
if(!authHeader){
  return res.status(401).send({message:'Unauthorized access'})
}
const token = authHeader.split(' ')[1];
jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,function(err,decoded){
  if(err){
    return res.status(403).send({message:'Forbidden access'})
  }
  req.decoded = decoded;
  next();
})

}
async function run(){
    try{
        await client.connect();
        const servicesCollection = client.db('doctors_portal').collection('services');
        const bookingCollection = client.db('doctors_portal').collection('bookings');
        const bedAllotmentCollection = client.db('doctors_portal').collection('bedAllotments');
        const usersCollection = client.db('doctors_portal').collection('users');
        const doctorCollection = client.db('doctors_portal').collection('doctors');
        const patientCollection = client.db('doctors_portal').collection('patients');
        const paymentCollection = client.db('doctors_portal').collection('payments');
        const nurseCollection = client.db('doctors_portal').collection('nurses');
        const pharmacistCollection = client.db('doctors_portal').collection('pharmacists');
        const laboratoristCollection = client.db('doctors_portal').collection('laboratorists');
        const accountantCollection = client.db('doctors_portal').collection('accountants');
        const receptionistCollection = client.db('doctors_portal').collection('receptionists');
     

        const verifyAdmin = async(req,res,next)=>{
          const requester =req.decoded.email; 
          const requesterAccount =await usersCollection.findOne({email:requester}) ; 
          if(requesterAccount.role === 'admin'){
            next();
          }
          else{
            res.status(403).send({message:'Forbidden'});
          }  
        }


        app.post('/create-payment-intent',verifyJWT, async(req,res)=>{
          const service =req.body;
          const price=service.price;
          const amount=price*100;
          const paymentIntent =await stripe.paymentIntents.create({
            amount:amount,
            currency:'usd',
            payment_method_types:['card']
          });
          res.send({clientSecret:paymentIntent.client_secret});
        });

     
  ////////////////// payments /////////////////////////

  app.get('/payment',verifyJWT,verifyAdmin, async(req,res)=>{
    const payments =await paymentCollection.find().toArray();
    res.send(payments);

  })
  //////////////////////////////////////////////////////

        app.patch('/booking/:id', async(req,res)=>{
          const id =req.params.id;
          const payment = req.body;
          const filter = {_id: ObjectId(id)};
          if(payment.transactionId){
            const updatedDoc ={
              $set:{
                paid:'paid',
                transactionId:payment.transactionId,
  
              }
            }
            const updatedBooking =await bookingCollection.updateOne(filter,updatedDoc);
            const result = await paymentCollection.insertOne(payment);
            res.send(updatedDoc);
          }
         else{
          const updatedDoc ={
            $set:{
              paid:'unpaid',
              transactionId:payment.transactionId,

            }
          }
          const updatedBooking =await bookingCollection.updateOne(filter,updatedDoc);
          const result = await paymentCollection.insertOne(payment);
          res.send(updatedDoc);
         }

        })
        /////////////////// bed allotment /////////////////////////////////////////
        app.patch('/patient/:id', async(req,res)=>{
          const id =req.params.id;
          const allotedBed = req.body;
          const filter = {_id: ObjectId(id)};
         
            const updatedDoc ={
              $set:{
                allotted:'allotted',
                careTaker:allotedBed.careTaker,
                bedType:allotedBed.bedType,
                bedNumber:allotedBed.bedNumber,
                allotmentDate:allotedBed.allotmentDate,
                allotmentTime:allotedBed.allotmentTime,
  
              }
            }
            const updatedPatient =await patientCollection.updateOne(filter,updatedDoc);
            const result = await bedAllotmentCollection.insertOne(allotedBed);
            res.send(updatedDoc); 

        })

        app.get('/bedAllotment',verifyJWT,verifyAdmin, async(req,res)=>{
          const bedAllotments =await bedAllotmentCollection.find().toArray();
          res.send(bedAllotments);

        })
        //////////////////////////////////////////////////////////////////////////
        app.get('/service',async(req,res)=>{
            const query ={};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });
///////////// Appointments /////////////////////////
        app.get('/appointment',async(req,res)=>{
          const query ={};
          const cursor = bookingCollection.find(query);
          const appointments = await cursor.toArray();
          res.send(appointments);
      });
///////////////////////////////////////////////////////////
        app.put('/user/admin/:email', verifyJWT, async(req,res)=>{
          const email =req.params.email; 
          const requester =req.decoded.email; 
          const requesterAccount =await usersCollection.findOne({email:requester}) ; 
          if(requesterAccount.role === 'admin'){
            const filter = { email:email };          
          const updateDoc = {
            $set:{role:'admin'},
          };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.send(result);
          }  
          else{
            res.status(403).send({message:'Forbidden'});
          }   
          

        })

        app.put('/user/:email',async(req,res)=>{
          const email =req.params.email;
          const user = req.body;
            const filter = { email:email };
          const options = { upsert: true };
          const updateDoc = {
            $set:user,    
            
          };
          const result = await usersCollection.updateOne(filter, updateDoc, options);
          
          const token =jwt.sign({email:email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1d'});
          res.send({result,token});
  

        })
        app.get('/admin/:email', async (req,res)=>{
          const email =req.params.email;
          const user = await usersCollection.findOne({email:email});
          const isAdmin = user.role === 'admin';
          res.send({admin:isAdmin});
        })
     

        app.get('/user',verifyJWT, async(req,res) =>{
          const users = await usersCollection.find().toArray();
          res.send(users);
        })
        app.get('/doctor', async(req,res) =>{
          const doctors = await doctorCollection.find().toArray();
          res.send(doctors);
        })

        //booking
        app.post('/booking',async (req,res)=>{
          const booking=req.body;
          const query ={treatment:booking.treatment,date:booking.date, patient:booking.patient}
          const exists =await bookingCollection.findOne(query);
          if(exists){
            return res.send({success:false,booking:exists})
          }
          const result =bookingCollection.insertOne(booking);
          return res.send({success:true,result});
        })
        //available slot
        app.get('/available',async(req,res)=>{
          const date=req.query.date || 'May 11, 2022';
          //step-1:get all services
          const services =await servicesCollection.find().toArray();
          //step-2:get the booking of that day
          const query ={date:date};
          const bookings =await bookingCollection.find(query).toArray();
          //step-3:for each service,
          services.forEach(service=>{
            //step-4:find bookings for that service
            const serviceBookings=bookings.filter(book=>book.treatment === service.name);
          //step-5:select slots for the service bookings

            const bookedSlots =serviceBookings.map(book=>book.slot);
            //step-6:select those slots that are not in bookingSlots
            const available = service.slots.filter(s=>!bookedSlots.includes(s));
            service.slots=available;
          });
          res.send(services);
        })

        app.get('/booking', verifyJWT, async(req,res)=>{
          const patient=req.query.patient;
         const decodedEmail =req.decoded.email;
         if(patient === decodedEmail){
          const query ={patient:patient};
          const bookings =await bookingCollection.find(query).toArray();
          res.send(bookings);
         }
         else{
           return res.status(403).send({message:'Forbidden access'});
         }
         
        });
        app.get('/booking/:id', verifyJWT, async(req,res)=>{
          const id= req.params.id;
          const query = {_id:ObjectId(id)};
          const booking =await bookingCollection.findOne(query);
          res.send(booking);
        })
// ************************* Doctor ***************************************
        app.get('/doctor',verifyJWT,verifyAdmin, async(req,res)=>{
          const doctors =await doctorCollection.find().toArray();
          res.send(doctors);

        })
        app.post('/doctor', verifyJWT,verifyAdmin, async(req,res)=>{
          const doctor=req.body;
          const result =await doctorCollection.insertOne(doctor);
          res.send(result);
        })
        app.delete('/doctor/:email', verifyJWT,verifyAdmin, async(req,res)=>{
          const email=req.params.email;
          const filter={email:email};
          const result =await doctorCollection.deleteOne(filter);
          res.send(result);
        })

// *************************************************************************
  // ****************************** patient ***********************************
  
        app.get('/patient',verifyJWT,verifyAdmin, async(req,res)=>{
          const patients =await patientCollection.find().toArray();
          res.send(patients);

        })
        app.post('/patient', verifyJWT,verifyAdmin, async(req,res)=>{
          const patient=req.body;
          const result =await patientCollection.insertOne(patient);
          res.send(result);
        })

      app.delete('/patient/:email', verifyJWT,verifyAdmin, async(req,res)=>{
        const email=req.params.email;
        const filter={email:email};
        const result =await patientCollection.deleteOne(filter);
        res.send(result);
      })
// *************************************************************************
// ************************* Nurse ***************************************
app.get('/nurse',verifyJWT,verifyAdmin, async(req,res)=>{
  const nurses =await nurseCollection.find().toArray();
  res.send(nurses);

})
app.post('/nurse', verifyJWT,verifyAdmin, async(req,res)=>{
  const nurse=req.body;
  const result =await nurseCollection.insertOne(nurse);
  res.send(result);
})
app.delete('/nurse/:email', verifyJWT,verifyAdmin, async(req,res)=>{
  const email=req.params.email;
  const filter={email:email};
  const result =await nurseCollection.deleteOne(filter);
  res.send(result);
})

// *************************************************************************

// ************************* Pharmacist ***************************************
app.get('/pharmacist',verifyJWT,verifyAdmin, async(req,res)=>{
  const pharmacists =await pharmacistCollection.find().toArray();
  res.send(pharmacists);

})
app.post('/pharmacist', verifyJWT,verifyAdmin, async(req,res)=>{
  const pharmacist=req.body;
  const result =await pharmacistCollection.insertOne(pharmacist);
  res.send(result);
})
app.delete('/pharmacist/:email', verifyJWT,verifyAdmin, async(req,res)=>{
  const email=req.params.email;
  const filter={email:email};
  const result =await pharmacistCollection.deleteOne(filter);
  res.send(result);
})

// *************************************************************************
// ************************* laboratorist ***************************************
app.get('/laboratorist',verifyJWT,verifyAdmin, async(req,res)=>{
  const laboratorists =await laboratoristCollection.find().toArray();
  res.send(laboratorists);

})
app.post('/laboratorist', verifyJWT,verifyAdmin, async(req,res)=>{
  const laboratorist=req.body;
  const result =await laboratoristCollection.insertOne(laboratorist);
  res.send(result);
})
app.delete('/laboratorist/:email', verifyJWT,verifyAdmin, async(req,res)=>{
  const email=req.params.email;
  const filter={email:email};
  const result =await laboratoristCollection.deleteOne(filter);
  res.send(result);
})

// *************************************************************************
// ************************* accountants ***************************************
app.get('/accountant',verifyJWT,verifyAdmin, async(req,res)=>{
  const accountants =await accountantCollection.find().toArray();
  res.send(accountants);

})
app.post('/accountant', verifyJWT,verifyAdmin, async(req,res)=>{
  const accountant=req.body;
  const result =await accountantCollection.insertOne(accountant);
  res.send(result);
})
app.delete('/accountant/:email', verifyJWT,verifyAdmin, async(req,res)=>{
  const email=req.params.email;
  const filter={email:email};
  const result =await accountantCollection.deleteOne(filter);
  res.send(result);
})

// *************************************************************************

// ************************* accountants ***************************************
app.get('/receptionist',verifyJWT,verifyAdmin, async(req,res)=>{
  const receptionists =await receptionistCollection.find().toArray();
  res.send(receptionists);

})
app.post('/receptionist', verifyJWT,verifyAdmin, async(req,res)=>{
  const receptionist=req.body;
  const result =await receptionistCollection.insertOne(receptionist);
  res.send(result);
})
app.delete('/receptionist/:email', verifyJWT,verifyAdmin, async(req,res)=>{
  const email=req.params.email;
  const filter={email:email};
  const result =await receptionistCollection.deleteOne(filter);
  res.send(result);
})

// *************************************************************************
//////////////////////////////// Patient search /////////////////////////////////////////////
app.get('/patients',async(req,res)=>{
  const text = req.query.name;
  const query = {name:text};
  const cursor = patientCollection.find(query);
  const patients = await cursor.toArray();
  res.send(patients);
});
//////////////////////////////// Appointment search /////////////////////////////////////////////
app.get('/appointments',async(req,res)=>{
  const text = req.query.phone;
  const query = {phone:text};
  const cursor = bookingCollection.find(query);
  const appointments = await cursor.toArray();
  res.send(appointments);
});

app.delete('/appointment/:patient', verifyJWT,verifyAdmin, async(req,res)=>{
  const patient=req.params.patient;
  const filter={patient:patient};
  const result =await bookingCollection.deleteOne(filter);
  res.send(result);
})
//////////////////////////////// Doctor search /////////////////////////////////////////////
app.get('/doctors',async(req,res)=>{
  const text = req.query.name;
  const query = {name:text};
  const cursor = doctorCollection.find(query);
  const doctors = await cursor.toArray();
  res.send(doctors);
});
//////////////////////////////// Nurse search /////////////////////////////////////////////
app.get('/nurses',async(req,res)=>{
  const text = req.query.name;
  const query = {name:text};
  const cursor = nurseCollection.find(query);
  const nurses = await cursor.toArray();
  res.send(nurses);
});
//////////////////////////////// Pharmacist search /////////////////////////////////////////////
app.get('/pharmacists',async(req,res)=>{
  const text = req.query.name;
  const query = {name:text};
  const cursor = pharmacistCollection.find(query);
  const pharmacists = await cursor.toArray();
  res.send(pharmacists);
});
//////////////////////////////// Laboratorist search /////////////////////////////////////////////
app.get('/laboratorists',async(req,res)=>{
  const text = req.query.name;
  const query = {name:text};
  const cursor = laboratoristCollection.find(query);
  const laboratorists = await cursor.toArray();
  res.send(laboratorists);
});
//////////////////////////////// Accountant search /////////////////////////////////////////////
app.get('/accountants',async(req,res)=>{
  const text = req.query.name;
  const query = {name:text};
  const cursor = accountantCollection.find(query);
  const accountants = await cursor.toArray();
  res.send(accountants);
});
//////////////////////////////// Receptionist search /////////////////////////////////////////////
app.get('/receptionists',async(req,res)=>{
  const text = req.query.name;
  const query = {name:text};
  const cursor = receptionistCollection.find(query);
  const receptionists = await cursor.toArray();
  res.send(receptionists);
});

//////////////////////////////////////////////////////////////////////////////

      app.delete('/user/:email', verifyJWT,verifyAdmin, async(req,res)=>{
        const email=req.params.email;
        const filter={email:email};
        const result =await usersCollection.deleteOne(filter);
        res.send(result);
      })

     

    }

    finally{

    }

}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from Hospital Management System Developed by ABU ISA')
})

app.listen(port, () => {
  console.log(`Hospital Management System listening on port ${port}`)
})