const mongoose = require("mongoose");
const validator = require("validator");


const userOtpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Please Enter Your Email"],
        unique: true,
        validate: [validator.isEmail, "Please Enter a valid Email"],
      },
    otp:{
        type:String,
        required:true
    }
});


// user otp model
const userotp = new mongoose.model("userotps",userOtpSchema);

module.exports = userotp