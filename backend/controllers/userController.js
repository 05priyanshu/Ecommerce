const ErrorHander = require("../utils/errorhander");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const User = require("../models/userModel");
const sendToken = require("../utils/jwtToken");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const cloudinary = require("cloudinary");
// const userotp = require("../models/userOtpModel");
// const nodeMailer = require("nodemailer");

// const  transporter = nodeMailer.createTransport({
//   host: process.env.SMPT_HOST,
//   port: process.env.SMPT_PORT,
//   service: process.env.SMPT_SERVICE,
//   auth: {
//     user: process.env.SMPT_MAIL,
//     pass: process.env.SMPT_PASSWORD,
//   },
// });

// Register a User
exports.registerUser = catchAsyncErrors(async (req, res, next) => {
  const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
    folder: "avatars",
    width: 150,
    crop: "scale",
  });

  const { name, email, password } = req.body;
  let user = await User.findOne({ email });

  if (user) {
    return res
      .status(400)
      .json({ success: false, message: "User already exists" });
  }
  // const otp = Math.floor(Math.random() * 1000000);

  user = await User.create({
    name,
    email,
    password,
    avatar: {
      public_id: myCloud.public_id,
      url: myCloud.secure_url,
    },
    // otp,
    // otp_expiry: new Date(Date.now() + process.env.OTP_EXPIRE * 60 * 1000),
  });
  // await sendMail(email, "Verify your account", `Your OTP is ${otp}`);
  // await sendEmail({
  //   email: user.email,
  //   subject: `Verify your account`,
  //   message:`Your OTP is ${otp}`,
  // });

  sendToken(
    user,
    201,
    res,
    "Registed"
  );
});

// const User = require('../models/User'); // Import the User model if not already imported

exports.genrateOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    let user = await User.findOne({ email });

    if (!user) {
      return next(new ErrorHander("Invalid email or user not found", 401));
    }

    if (user.verified === true) {
      return next(new ErrorHander("User is already verified", 400));
    }

    const otp = Math.floor(Math.random() * 1000000);

    user.otp = otp;
    user.otp_expiry = new Date(Date.now() + process.env.OTP_EXPIRE * 60 * 1000);

    await user.save();

    // Send OTP to user via email here (uncomment this code once you have the sendEmail function)

    await sendEmail({
      email: user.email,
      subject: `Verify your account`,
      message: `Your OTP is ${otp}`,
    });
    

    res.status(200).json({
      success: true,
      message: "OTP sent to your email, please verify your account",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// OTP verify
exports.verify = async (req, res) => {
  try {
    const otp = Number(req.body.otp);
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.otp) {
      return res
        .status(400)
        .json({ success: false, message: "OTP not generated" });
    }

    if (user.otp !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP" });
    }

    if (user.otp_expiry < Date.now()) {
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });
    }

    user.verified = true;
    user.otp = null;
    user.otp_expiry = null;

    await user.save();

    // sendToken(res, user, 200, "Account Verified");
    res.status(200).json({ success:true, message:"Account verified" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// Login User
exports.loginUser = catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  // checking if user has given password and email both

  if (!email || !password) {
    return next(new ErrorHander("Please Enter Email & Password", 400));
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorHander("Invalid email or password", 401));
  }

  const isPasswordMatched = await user.comparePassword(password);

  if (!isPasswordMatched) {
    return next(new ErrorHander("Invalid email or password", 401));
  }

  sendToken(user, 200, res, "Login Successful");
});

// Logout User
exports.logout = catchAsyncErrors(async (req, res, next) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged Out",
  });
});

// Forgot Password
exports.forgotPassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorHander("User not found", 404));
  }

  // Get Password Token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  const resetPasswordUrl = `${req.protocol}://${req.get(
    "host"
  )}/password/reset/${resetToken}`;

  const message = `Your password reset token is :- \n\n ${resetPasswordUrl} \n\nIf you have not requested this email then, please ignore it.`;

  try {
    await sendEmail({
      email: user.email,
      subject: `Ecommerce Password Recovery`,
      message,
    });

    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ErrorHander(error.message, 500));
  }
});

// Reset Password
exports.resetPassword = catchAsyncErrors(async (req, res, next) => {
  // creating token hash
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new ErrorHander(
        "Reset Password Token is invalid or has been expired",
        400
      )
    );
  }

  if (req.body.password !== req.body.confirmPassword) {
    return next(new ErrorHander("Password does not password", 400));
  }

  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  sendToken(user, 200, res, "reset-passward");
});

// Get User Detail
exports.getUserDetails = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    user,
  });
});

// update User password
exports.updatePassword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  const isPasswordMatched = await user.comparePassword(req.body.oldPassword);

  if (!isPasswordMatched) {
    return next(new ErrorHander("Old password is incorrect", 400));
  }

  if (req.body.newPassword !== req.body.confirmPassword) {
    return next(new ErrorHander("password does not match", 400));
  }

  user.password = req.body.newPassword;

  await user.save();

  sendToken(
    user,
    200,
    res,
    "OTP sent to your email, please verify your account"
  );
});

// update User Profile
exports.updateProfile = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
  };

  if (req.body.avatar !== "") {
    const user = await User.findById(req.user.id);

    const imageId = user.avatar.public_id;

    await cloudinary.v2.uploader.destroy(imageId);

    const myCloud = await cloudinary.v2.uploader.upload(req.body.avatar, {
      folder: "avatars",
      width: 150,
      crop: "scale",
    });

    newUserData.avatar = {
      public_id: myCloud.public_id,
      url: myCloud.secure_url,
    };
  }

  const user = await User.findByIdAndUpdate(req.user.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
  });
});

// Get all users(admin)
exports.getAllUser = catchAsyncErrors(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    success: true,
    users,
  });
});

// Get single user (admin)
exports.getSingleUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHander(`User does not exist with Id: ${req.params.id}`)
    );
  }

  res.status(200).json({
    success: true,
    user,
  });
});

// update User Role -- Admin
exports.updateUserRole = catchAsyncErrors(async (req, res, next) => {
  const newUserData = {
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
  };

  await User.findByIdAndUpdate(req.params.id, newUserData, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  res.status(200).json({
    success: true,
  });
});

// Delete User --Admin
exports.deleteUser = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(
      new ErrorHander(`User does not exist with Id: ${req.params.id}`, 400)
    );
  }

  const imageId = user.avatar.public_id;

  await cloudinary.v2.uploader.destroy(imageId);

  await user.remove();

  res.status(200).json({
    success: true,
    message: "User Deleted Successfully",
  });
});

// // user send otp
// exports.userOtpSend = async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//       res.status(400).json({ error: "Please Enter Your Email" })
//   }

//   try {
//       const presuer = await users.findOne({ email: email });

//       if (presuer) {
//           const OTP = Math.floor(100000 + Math.random() * 900000);

//           const existEmail = await userotp.findOne({ email: email });

//           if (existEmail) {
//               const updateData = await userotp.findByIdAndUpdate(req.params.id, {
//                   otp: OTP
//               }, {
//                 new: true,
//                 runValidators: true,
//                 useFindAndModify: false,
//               }
//               );
//               await updateData.save();

//               const mailOptions = {
//                   from: process.env.EMAIL,
//                   to: email,
//                   subject: "Sending Eamil For Otp Validation",
//                   text: `OTP:- ${OTP}`
//               }
//               transporter.sendMail(mailOptions, (error, info) => {
//                   if (error) {
//                     res.status(200).json({
//                       success: true,
//                       message: `Email not sent to ${presuer.email} `,
//                     });
//                   } else {
//                     res.status(200).json({
//                       success: true,
//                       message: `Email sent to ${presuer.email} successfully`,
//                     });
//                   }
//               })

//           } else {

//               const saveOtpData = new userotp({
//                   email, otp: OTP
//               });

//               await saveOtpData.save();
//               const mailOptions = {
//                   from: process.env.EMAIL,
//                   to: email,
//                   subject: "Sending Eamil For Otp Validation",
//                   text: `OTP:- ${OTP}`
//               }

//               tarnsporter.sendMail(mailOptions, (error, info) => {
//                   if (error) {
//                     res.status(200).json({
//                       success: true,
//                       message: `Email not sent to ${presuer.email} `,
//                     });
//                   } else {
//                     res.status(200).json({
//                       success: true,
//                       message: `Email sent to ${presuer.email} successfully`,
//                     });
//                   }
//               })
//           }
//       } else {
//           res.status(400).json({ error: "This User Not Exist In our Db" })
//       }
//   } catch (error) {
//       res.status(400).json({ error: "Invalid Details", error })
//   }
// };
