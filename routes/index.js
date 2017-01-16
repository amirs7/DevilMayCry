var express = require("express");
var router  = express.Router();
var passport = require("passport");
var User = require("../models/user");
var sanitize = require('mongo-sanitize');
var nodemailer = require('nodemailer');
var request = require('request');
var middleware = require('../middleware/index');
var mailer = require('../middleware/mailSender');
var Group = require("../models/group");
var token = require('../middleware/token');
var crypto = require("crypto");
const mailTemplates = 'middleware/mailTemplates/';
var async = require("async");
var simplesmtp = require("simplesmtp");
var fs = require("fs");
var config = require("../config/test");
'use strict';

// var host = "http://acm.ut.ac.ir/dmc";
// var baseURL = "/dmc";

// router.all("/admin/*",middleware.isLoggedIn,middleware.havePermission);

router.get("/", function(req, res){
    // middleware.dmcRedirect(res,"/aaaa");
    res.render("landing");
});

// router.get("/aaaa", function(req, res){
//     middleware.dmcRedirect(res,"/eee");
// });
// router.get("/eee", function(req, res){
//     res.render('landing');
// });

router.get("/ranking", function(req, res){
    Group.find({}).populate(["competition"]).sort({"competition.score":-1}).exec(function (err,groups) {
        res.render("dashboard/ranking",{groups:groups});
    });
});

// show register form
router.get("/register", function(req, res){
   res.render("register");
});

router.post('/register',function(req, res,next) {
    var username = sanitize(req.body.username);
    var password = sanitize(req.body.password);
    var firstname = sanitize(req.body.firstname);
    var lastname = sanitize(req.body.lastname);
    var studentId = sanitize(req.body.studentId);
    var email = sanitize(req.body.email);
    var user = {
        firstname: firstname,
        lastname: lastname,
        username: username,
        studentId: studentId,
        email: email,
        password: password,
    };
    User.findOne({$or:[{username: user.username},{studentId:studentId}]}).exec(function (err, existUser) {
        if (err) return next(err);
        if (existUser) {
            req.flash('error', 'Username already exist');
            middleware.dmcRedirect(res,'/register');
        } else {
            mailer.sendTemplateTo(mailTemplates+"verification",{address:host,link:host+"/register/"+ token.setToken(user), name: firstname}
                ,user.username,function (err,info) {
                console.log("MERR: "+err);
                console.log("MINF: "+info);
                console.log(host+"/register/"+token.setToken(user));
                req.flash("success", "برای تأیید ایمیل، به ایمیل خود مراجعه کنید.");
                middleware.dmcRedirect(res,'/');
            });

        }
    });
});

router.get('/register/:verification_token',function(req, res,next) {
    var user;
    try {
        user = token.decodeToken(req.params.verification_token);
        User.create(user,function (err, newUser) {
            if (err) return next(err);
            middleware.dmcRedirect(res,'/login');
        });
    }catch(err) {
        req.flash("error", "لینک نامعتبر");
        res.dmcRedirect("/");
    }
});
//show login form
router.get("/login", function(req, res){
   res.render("login");
});

router.post('/login', function(req, res, next){
    passport.authenticate('local', function(err, user, info) {
        if (err) return next(err);
        if (!user) {
            return middleware.dmcRedirect(res,'/login');
        }
        req.logIn(user, function(err) {
            if (err) return next(err);
            req.user = null;
            return middleware.dmcRedirect(res,baseURL+"/dashboard");
        });
    })(req, res, next);
});

// logout route
router.get("/logout", function(req, res){
   req.logout();
   req.flash("success", "شما از سایت خارج شدید!");
   middleware.dmcRedirect(res,"");
});

router.get("/test", function(req, res){
    res.render("dev/test");
});

router.get('/forgot', function(req, res,next) {
    res.render('forgot_password', {user: req.user});
});

router.post('/forgot', function(req, res, next) {
    User.findOne({ username: req.body.username}, function(err, user) {
        if(!user){
            req.flash("error","Username doesnt exist!")
            middleware.dmcRedirect(res,'/forgot');
        }
        else{
            user.token = token.generateToken(50);
            user.tokenExpires = Date.now() + 3600*60;
            user.save();
            mailer.sendTemplateTo(mailTemplates+"resetpass",{address:host,link:host+"/reset/"+ user.token, name: user.firstname},user.username,function (err,info) {
                console.log(info);
                console.log(err);
                console.log(host+"/reset/"+user.token);
                req.flash("success", "به ایمیل خود مراجعه کنید.");
                middleware.dmcRedirect(res,'');
            });
        }
    });
});

router.get('/reset/:token', function(req, res,next) {
    User.findOne({ token:req.params.token}
        , function(err, user) {
        if(err) return next(err);
        if (!user) {
            req.flash('error', 'لینک تغییر رمزعبور شما باطل شده یا نا متعبر است.');
            return middleware.dmcRedirect(res,'/forgot');
        } else{
            res.render('reset_password', {user:user,token:req.params.token});
        }
    });
});

router.post('/reset/:token', function(req, res,next) {
    // ,{resetPasswordExpires: { $gt: Date.now() }} ]
    async.waterfall([
        function(done) {
            User.findOne({ token:req.params.token},
                function(err, user) {
                    if (!user) {
                        req.flash('error', 'لینک تغییر رمزعبور شما باطل شده یا نا متعبر است.');
                        return middleware.dmcRedirect(res,'back');
                    }
                    user.password = req.body.password;
                    user.token = undefined;
                    user.tokenExpires = undefined;
                    user.save(function(err) {
                    req.logIn(user, function(err) {
                        req.flash('success', 'رمزعبور شما با موفقیت تغییر کرد.');
                        done(err, user);
                    });
                });
            });
        },
    ], function(err) {
        middleware.dmcRedirect(res,'/login');
    });
});

module.exports = router;
