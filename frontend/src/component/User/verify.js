import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { loadUser, verify,genrateOtp } from '../../actions/userAction';
import "./verify.css"
import { useSelector } from "react-redux";

const Verify = ({history}) => {
  const [otp, setOtp] = useState('');
  const dispatch = useDispatch();
  const { user, loading, isAuthenticated } = useSelector((state) => state.user);

  const verifyHandler = () => {
    console.log(user.email)
    dispatch(verify(otp,user.email,onsuccess));
  };
  const onsuccess =()=>{
    dispatch(loadUser());
  }
  useEffect(() => {
    if (isAuthenticated === false) {
      history.push("/login");
    }
    else{
        dispatch(genrateOtp(user.email));
    }
  }, [history, isAuthenticated]);


  return (
    <div className="verify-container">
      <h2>Verification</h2>
      <div className="input-container">
        <input
          className="input"
          type="text"
          placeholder="OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />
      </div>
      <button className="btn" onClick={verifyHandler}>
        Verify
      </button>
    </div>
  );
};
export default Verify;
