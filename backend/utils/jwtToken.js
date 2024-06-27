// Create Token and saving in cookie

const sendToken = (user, statusCode, res,message) => {
  const token = user.getJWTToken();

  // options for cookie
  const options = {
    expires: new Date(
      Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    tasks: user.tasks,
    verified: user.verified,
  };

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    user:userData,
    token,
    message
  });
};

module.exports = sendToken;
