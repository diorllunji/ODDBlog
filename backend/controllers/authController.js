const asyncHandler=require("express-async-handler");
const bcrypt=require("bcryptjs");
const{User,validateRegisterUser, validateLoginUser}=require("../models/User");
const VerificationToken = require("../models/VerificationToken");
const crypto=require("crypto");
const sendEmail=require("../utils/sendEmail");

/**
 * @desc Register new user
 * @router /api/auth/register
 * @method POST
 * @access public
 */


module.exports.registerUserCtrl=asyncHandler(async(req,res)=>{
    const{error}=validateRegisterUser(req.body);
    if(error){
        return res.status(400).json({message:error.details[0].message});
    }

    let user=await User.findOne({email:req.body.email});
    if(user){
        return res.status(400).json({message:"User already exists"});
    }

    const salt=await bcrypt.genSalt(10);
    const hashedPassword=await bcrypt.hash(req.body.password,salt);

    user=new User({
        username:req.body.username,
        email:req.body.email,
        password:hashedPassword,
    }); 
    await user.save();

    const verificationToken=new VerificationToken({
        userId:user._id,
        token:crypto.randomBytes(32).toString("hex"),
    });
    await verificationToken.save();

    const link=`${process.env.CLIENT_DOMAIN}/users/${user._id}/verify/${verificationToken.token}`;

    const htmlTemplate=`
    <div>
        <p>Click the link below to verify your email</p>
        <a href="${link}">Verify</a>
    </div>`;

    await sendEmail(user.email,"Verify your email",htmlTemplate);

    res.status(200).json({message:"We sent you an email, please verify your address"});
});

/**
 * @desc Login new user
 * @router /api/auth/login
 * @method POST
 * @access public
 */

module.exports.loginUserCtrl=asyncHandler(async(req,res)=>{
    const{error}=validateLoginUser(req.body);
    if(error){
        return res.status(400).json({message:error.details[0].message});
    }
    
    const user=await User.findOne({email:req.body.email});
    if(!user){
        return res.status(400).json({message:"Invalid name or password"});
    }

    const isPasswordMatch=await bcrypt.compare(req.body.password,user.password);
    if(!isPasswordMatch){
        return res.status(400).json({message:"Invalid name or password"});
    }

    if(!user.isAccountVerified){
        let verificationToken=await VerificationToken.findOne({
            userId:user._id,
        });

        if(!verificationToken){
            verificationToken=new VerificationToken({
                userId:user._id,
                token:crypto.randomBytes(32).toString("hex"),
            });
            await verificationToken.save();
        }

        const link=`${process.env.CLIENT_DOMAIN}/users/${user._id}/verify/${verificationToken.token}`;

    const htmlTemplate=`
    <div>
        <p>Click the link below to verify your email</p>
        <a href="${link}">Verify</a>
    </div>`;

    await sendEmail(user.email,"Verify your email",htmlTemplate);

        return res.status(400).json({message:"We sent you an email, please verify your address"});
    }

    const token=user.generateAuthToken();

    res.status(200).json({
        _id:user._id,
        isAdmin: user.isAdmin,
        profilePhoto: user.profilePhoto,
        token,
        username:user.username,
    });

});

/**
 * @desc Verify user account
 * @router /api/auth/:userId/verify/:token
 * @method GET
 * @access public
 */
module.exports.verifyUserAccountCtrl=asyncHandler(async(req,res)=>{
    const user=await User.findById(req.params.userId);
        if(!user){
            return res.status(400).json({message:"Invalid link"});
        } 
    
    const verificationToken=await VerificationToken.findOne({
        userId:user._id,
        token:req.params.token,
    });

    if(!verificationToken){
        return res.status(400).json({message:"Invalid link"});
    } 

    user.isAccountVerified=true;
    await user.save();

    await verificationToken.deleteOne();

    res.status(200).json({message:"Account verified"});



    

 
});