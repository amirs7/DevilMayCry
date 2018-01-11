var express = require("express");
var router  = express.Router();
var passport = require("passport");
var User = require("../models/user");
var Puzzle = require("../models/puzzle");
var sanitize = require('mongo-sanitize');
var nodemailer = require('nodemailer');
var request = require('request');
var middleware = require('../middleware/index');
var cookie = require('../middleware/cookie');
var mailer = require('../middleware/mailSender');
var normalizeEmail = require('../middleware/emailNormalizer');
var Group = require("../models/group");
var token = require('../middleware/token');
var crypto = require("crypto");
const mailTemplates = 'middleware/mailTemplates/';
var async = require("async");
var simplesmtp = require("simplesmtp");
var fs = require("fs");
var config = require("../config/global");
var Rule = require("../models/rule");
'use strict';

// var host = "http://acm.ut.ac.ir/dmc";
// var baseURL = "/dmc";

// router.all("/admin/*",middleware.isLoggedIn,middleware.havePermission);

router.get("/", function(req, res){

    Rule.findOne({name:"DMC"}).exec(function (err,rule) {
        var time;
        if(Date.now() < rule.startDate)
            time = rule.startDate - Date.now();
        else if(Date.now() - rule.startDate < rule.duration)
            time = rule.startDate - Date.now() + rule.duration;
        else
            time = 0;
        res.render("landing", {time: time, currentUser: req.user});
    });
});

// router.get("/aaaa", function(req, res){
//     middleware.dmcRedirect(res,"/eee");
// });
// router.get("/eee", function(req, res){
//     res.render('landing');
// });

router.get("/ranking", function(req, res){
  Group.find({}).populate("competition").sort({"competition.stage": -1}).limit(20).exec(function (err,groups) {
      Puzzle.find().populate("problem").exec(function (err,puzzles) {
          groups.forEach(function (group) {
              group.competition.score  = 0;
              puzzles.forEach(function (puzzle) {
                  if((group.competition.puzzles.indexOf(puzzle._id)!=-1)&&puzzle.accepted)
                      group.competition.score += puzzle.score;

              });
              group.competition.save();
              group.save();
          });
          res.render("dashboard/ranking",{groups:groups,currentUser:req.user});
      });
  });
});

// show register form
router.get("/register", function(req, res){
    res.render("register", {currentUser: req.user});
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
        password: password
    };
    User.findOne({$or:[{username: user.username},{studentId:studentId}]}).exec(function (err, existUser) {
        if (err) return next(err);
        if (existUser) {
            req.flash('error', 'Username already exist!');
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
        User.findOne({username:user.username}).exec(function (err,foundUser) {
           if(foundUser) {
                req.flash("error", "لینک ثبت‌نام قبلاً استفاده شده است.");
                middleware.dmcRedirect(res,'/login');
           } else {
               User.create(user,function (err, newUser) {
                   if (err) return next(err);
                   middleware.dmcRedirect(res,'/login');
               });
           }
        });
    }catch(err) {
        req.flash("error", "لینک نامعتبر");
        middleware.dmcRedirect(res,'/');
    }
});
//show login form
router.get("/login", function(req, res){
    res.render("login", {currentUser: req.user});
});

router.post('/login', function(req, res, next){
    passport.authenticate('local', function(err, user, info) {
        if (err) return next(err);
        if (!user) {
            req.flash("error","نام کاربری موجود نیست!");
            return middleware.dmcRedirect(res,'/login');
        }
        req.logIn(user, function(err) {
            if (err) return next(err);
            req.user = null;
            return middleware.dmcRedirect(res, "/dashboard/");
        });
    })(req, res, next);
});

// logout route
router.get("/logout", function(req, res){
   req.logout();
   req.flash("success", "شما از سایت خارج شدید!");
   middleware.dmcRedirect(res,"");
});

router.get("/about", function(req, res) {
    res.render('about', {currentUser: req.user});
});

module.exports = router;
