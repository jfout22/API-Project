// backend/routes/api/users.js
const express = require('express');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { setTokenCookie, requireAuth } = require('../../utils/auth');
const {Spot, SpotImage, User, Review, ReviewImage, Booking} = require('../../db/models');

const { check, validationResult } = require('express-validator');
// const { validateReview } = require('./reviewValidator.js')
const { handleValidationErrors } = require('../../utils/validation');

const router = express.Router();


//? TITLE OF BAD REQUEST STILL SHOWS UP
const validateSpot = [
    check('address')
        .exists().notEmpty()
        .withMessage('Street address is required'),
    check('city')
        .exists().notEmpty()
        .withMessage("City is required"),
    check('state')
        .exists().notEmpty()
        .withMessage("State is required"),
    check('country')
        .exists().notEmpty()
        .withMessage("Country is required"),
    //? HOW TO DEFAULT LAT AND LNG?
    check('lat')
        .exists().isFloat({min: -89, max: 91})
        .withMessage("Latitude must be within -90 and 90"),
    check('lng')
        .exists().isFloat({min: -181, max: 181})
        .withMessage("Longitude must be within -180 and 180"),
    check('name')
        .exists().notEmpty().isLength({max:50})
        .withMessage("Name must be less than 50 characters"),
    check('description')
        .exists().notEmpty()
        .withMessage("Description is required"),
    check('price')
        .exists().isInt({gt: 0})
        .withMessage("Price per day must be a positive number"),
    handleValidationErrors
];
//*Helper Function: Does Spot Exist?

//*Helper Function for checking if user owns the spot:
function isOwner(userId,spot){
    //if the userId matches the ownerId on the spot,
    //then send back a true
    if (spot.ownerId == userId) return true
    else{return false}

    //else, send back false then send an error message
}

const bookingOwner = function(userId, booking){
    if (booking.userId === userId) return true
    else{return false}
};


// //*Get all Reviews by Spot's Id:

router.get('/:spotId/reviews', async(req,res,next)=>{
    const {spotId} = req.params;
    const spot = await Spot.findByPk(spotId);
    console.log(spot)
    if (!spot || spot === null){
        res.status(404);
        return res.json({
            message: "Spot couldn't be found"
        })
    }else{
        const allReviews = {};

        const Reviews = await Review.findAll({
            where:{spotId:spotId},
            include:[{model:ReviewImage}]
        })
        allReviews.Reviews = Reviews;
        return res.json(allReviews)

    };

});

//Get all Bookings for a Spot based on the Spot's Id
//RequireAuth

router.get('/:spotId/bookings', requireAuth, async(req,res,next)=>{
    const userId = req.user.id
    const { spotId } = req.params;
    const spot = await Spot.findByPk(spotId)
    if (!spot){
        res.status(404);
        return res.json({
            message: "Spot couldn't be found"
        });
    }

    const owned = isOwner(userId, spot)

    //Response for if you own the spot
    if(owned){
        //do not include the userId's
        const allBookings = await Booking.findAll({
            include: [{
                model:User,
                attributes:{
                    exclude: ['username','hashedPassword','email', 'createdAt','updatedAt']
                }
               // Want the scope used HERE!
            }],
            where: {spotId:spotId}
        });
        return res.json({Bookings:allBookings})

    }else{

    //Response for if you do NOT own the spot
    const allBookings = await Booking.scope('hideUser').findAll({
        where:{
            spotId:spotId
        },
    });

    return res.json({Bookings:allBookings})

    };
})

//*Create a booking from a spot based on the Spot's Id
//Require Auth
//isOwner must be false
router.post('/:spotId/bookings', requireAuth, async(req,res,next)=>{
    const userId = req.user.id;
    let { spotId } = req.params;
    spotId = Number(spotId)

    //Ensure Spot exists
    const spot = await Spot.findByPk(spotId);
    if (!spot){
        res.status(404);
        return res.json({
            message: "Spot couldn't be found"
        });
    }
    //Ensure user is not the owner
    const owned = isOwner(userId, spot);
    //if user is owner, throw an error
    if (owned){
        res.status(403);
        return res.json({
            message:"Forbidden"
        });
    };

    const { startDate, endDate } = req.body;
    const newStartDate = new Date(startDate);
    const newEndDate = new Date(endDate);

    //Check for any Validation Errors
    let errors = {};

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Add 1 because months are zero-indexed
    const day = String(currentDate.getDate()).padStart(2, '0');

    const formattedDate = `${year}-${month}-${day}`;



    //Ensure that the startDate is not in the past
    if (newStartDate < formattedDate){
        errors.startDate = "startDate cannot be in the past"

    };
    //Ensure that the endDate is not the same as or before the startDate
    if (newEndDate === newStartDate || newEndDate < newStartDate){
        errors.endDate = "endDate cannot be on or before startDate"
    };
    if (errors.startDate || errors.endDate){
        res.status(400);
        const e = new Error()
        e.message = "Bad Request";
        e.errors = errors;
        return res.json(e)
    }
    //? What about if a user does not input any dates

    //?HOW TO SEARCH FOR BOOKING TIMEFRAMES?

    // query for all dates
    // once you find a booking and its dates
    // look to see if the start date or end date is included.
    //
 //! New Goal:

 //Query for all and then do the comparisons:

//! Come Back to this later for more efficiency


    const isConflictingStart = await Booking.findOne({
        //find where the date range might inc
        where: {
            startDate:{
                [Op.between]:[newStartDate, newEndDate]
            },

        }

    });

    //!Debugging:
    // * Now, owner cannot book
    //*if the start Date conflicts with an end date, that is going throwing error correctly

    //*if you do not own spot, getting the booking is CORRECT
    //*if you OWN the spot, getting the bookings is correct

    const isConflictingEnd = await Booking.findOne({
        //End date is in conflict when:
        // It is between an already booked date range
        // or it is on the exact last day of end date
        where:{
            endDate:{
                [Op.between]:[newStartDate, newEndDate],
            },
        }
    });


    //Check for Booking conflicts
    const bookingErrors = {};

    console.log(isConflictingStart, isConflictingEnd)
    //Conflicts:
    // start date is included in a date range (inclusive date range)
    if(isConflictingStart){
        bookingErrors.startDate = "Start date conflicts with an existing booking"
    };
    console.log(bookingErrors)
    //endDate is included in a date range (inclusive date range)
    if(isConflictingEnd){
        bookingErrors.endDate = "End date conflicts with an existing booking"
    };
    console.log(bookingErrors)

    if (bookingErrors.startDate || bookingErrors.endDate){
        res.status(403);
        const e = new Error()
        e.message = "Sorry, this spot is already booked for the specified dates"
        e.errors = bookingErrors;
        return res.json(e)
    }

    //If there are no errors/conflicts
    const newBooking = await Booking.create({
        spotId:spotId,
        userId:userId,
        startDate:newStartDate,
        endDate:newEndDate
    })

    return res.json(newBooking)
})


//* GET ALL SPOTS
router.get('/', async(req,res,next)=>{
    const allSpots = await Spot.findAll();
    return res.json(allSpots)
})

//*GET ALL SPOTS OWNED BY CURR USER
router.get('/current', requireAuth, async(req,res,next)=>{
    const currId = req.user.dataValues.id
    const ownedSpots = {};

    let Spots = await Spot.findAll({
        where: {ownerId: currId}
    })
    ownedSpots.Spots = Spots;
    // console.log(ownedSpots);
    return res.json(ownedSpots)
})

//!THIS WORKS BUT I NEED TO ADDRESS AN ON DELETE
//! CASADE FOR WHEN A USER IS DELETED,
//! THEN THEIR SPOTS ARE DELETED.


//* GET ALL SPOTS FROM ID
router.get('/:spotId', async(req,res,next)=>{
    const { spotId } = req.params;
    const spot = await Spot.findByPk(spotId,{
        include: [{model:SpotImage},{model:User, as: 'Owner'}]
    });
    if (spot === null){
        res.status(404)
        return res.json({
            message: "Spot couldn't be found"
        })
    }
    return res.json(spot);

})


//*Edit a Booking:
// Require isOwner
router.put('/:bookingId', requireAuth, async(req,res,next)=>{
    const { bookingId } = req.params;
    const { userId }= req.user.id;

    const booking = await Booking.findByPk(bookingId);
    if(!booking){
        res.status(404)
        return res.json({
            message: "Booking couldn't be found"
        })
    };



    //Throw an error if the editor does not own the booking
    const owned = bookingOwner(userId, booking)
    //if not owned
    if(!owned){
        res.status(403);
        return res.json({
            message:"Forbidden"
        });
    };
    const {startDate, endDate} = req.body;
    const newStartDate = new Date(startDate);
    const newEndDate = new Date(endDate);

    //Past bookings cannot be modified. Check the current date against the
    // end date.
    // if the current date is greater than the end date,
    if(booking.endDate < newEndDate){
        res.status(403);
        return res.json({
            message: "Past bookings can't be modified"
        })
    }


    //Check for any Validation Errors
    let errors = {};
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Add 1 because months are zero-indexed
    const day = String(currentDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    //Ensure that the startDate is not in the past
    if (newStartDate < formattedDate){
        errors.startDate = "startDate cannot be in the past"
    };
    //Ensure that the endDate is not the same as or before the startDate
    if (newEndDate === newStartDate || newEndDate < newStartDate){
        errors.endDate = "endDate cannot be on or before startDate"
    };
    if (errors.startDate || errors.endDate){
        res.status(400);
        const e = new Error()
        e.message = "Bad Request";
        e.errors = errors;
        return res.json(e)
    }


    //!BOOKING CONFLICTS COME BACK TO THIS:
    //insert code here:



    //!
    const updatedBooking = await booking.update({
        startDate,
        endDate,
        userId
    });


})


// ADD AN IMAGE TO A SPOT

router.post('/:spotId/images', requireAuth, async(req,res,next)=>{
    const currId = req.user.dataValues.id;
    const { spotId } = req.params;
    const { url, preview } = req.body;
    const spot = await Spot.findByPk(spotId)
    if (spot === null){
        res.status(404);
        return res.json({
            message: "Spot couldn't be found"
        })
    }else if(!isOwner(currId,spot)){
        res.status(403);
        return res.json({
            message: "Forbidden"
        })
    }else{
        const newImage = await SpotImage.create({url,spotId, preview});

        const response = {
            id: newImage.id,
            url: newImage.url,
            preview: newImage.preview
        }
        return res.json(response)
    }

})

// CREATE A SPOT
//? MADE AVG RATING AND PREVIEW IMAGE DEFAULT TO UNDEFINED ON MODEL
//? SO THAT IT DOESN'T SHOW UP UNLESS THEY MAKE IT.

//*!POST api/spot/:spotId/reviews:
//! Create a Review for a Spot based on the Spot's Id
router.post('/:spotId/reviews', requireAuth, async(req,res,next)=>{
    const { spotId } = req.params;

    const spot = await Spot.findByPk(spotId)

    if (!spot){
        res.status(404)
        return res.json({
            message:"Spot couldn't be found"
        })
    }
    const  userId  = req.user.id;


    const { review, stars } = req.body;

    //Body Validation Errors
    let errors = {};

    if(!review){
        errors.review = 'Review text is required'
    };
    // if the stars are less than 1 or more than 5 or if in general the type of stars is not a number then
    // throw this error

    if ((stars < 1 || stars > 5) || typeof stars !== 'number'){
        errors.stars = 'Stars must be an integer from 1 to 5'
    }
    if(errors.review || errors.stars){
        e = new Error()
        e.message = "Bad Request"
        e.errors = errors;

        res.status(400)
        return res.json(e)
    }



    const isAlreadyReview = await Review.findOne({
        where: {
            userId:userId,
            spotId:spotId
        }
    })
    if(isAlreadyReview) {
        res.status(500)
        return res.json({message: "User already has a review for this spot"})
    }

    const newReviewForSpot = await Review.create({userId,spotId,review,stars})
    res.status(201);
    return res.json(newReviewForSpot)

});



router.post('/', requireAuth, validateSpot, async(req,res,next)=>{
    const {address, city, state, country, lat, lng, name, description, price} = req.body;
    const ownerId = req.user.id;

    const newSpot = await Spot.create({ownerId, address, city, state, country, lat, lng, name, description, price});

    return res.json(newSpot)
});

//*EDIT A SPOT
//*IT CHANGED IT YAY!




router.put('/:spotId', requireAuth,validateSpot,async(req,res,next)=>{
    const currId = req.user.dataValues.id;
    const {spotId} = req.params;
    const spot = await Spot.findByPk(spotId);
    if (spot === null){
        res.status(404);
        return res.json({
            message: "Spot couldn't be found"
        });
    }else if (!isOwner(currId,spot)){
            res.status(403);
            return res.json({
                message:"Forbidden"
            })
        }else{
            const { address, city, state, country, lat, lng, name, description, price} = req.body;

            await spot.update({
                address,
                city,
                state,
                country,
                lat,
                lng,
                name,
                description,
                price
            })


            //? NEED TO CHECK TO MAKE SURE THE EDITS ARE
            //? OKAY BEFORE WE PUSH THEM TO THE DB

            return res.json(spot)
        }
});


router.delete('/:spotId',requireAuth, async(req,res,next)=>{
    const currId = req.user.id;
    const {spotId} = req.params;
    const spot = await Spot.findByPk(spotId);
    if (!spot){
        res.status(404);
        return res.json({
            message: "Spot couldn't be found"
        });
    }else if (!isOwner(currId,spot)){
        res.status(403);
        return res.json({
            message:"Forbidden"
        })
    }else{
        await spot.destroy();
        res.status(200);
        return res.json({
            message:"Successfully deleted"
        })
    }
})




module.exports = router;
