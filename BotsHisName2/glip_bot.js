﻿/**
 * Created by pawan.venugopal on 10/31/16.
 */

"use strict";

require('dotenv').config();

var Botkit = require('./lib/Botkit.js');
var os = require('os');
var http = require('http');
var request = require('request');
var fs = require('fs');
var accessToken = "";
var platform = null;
var Client = require("node-wolfram");
var Wolfram = new Client("PGAKAJ-U75WURKQ69");

if (!process.env.clientId || !process.env.clientSecret || !process.env.port) {
    console.log('Error: Specify clientId clientSecret and port in environment');
    process.exit(1);
}

var controller = Botkit.glipbot({
    debug: true
}).configureGlipApp({
    clientId: process.env.clientId,
    clientSecret: process.env.clientSecret,
    redirectUri: process.env.redirectUri,
    apiRoot: process.env.apiRoot
    // accessToken: '',
    // subscriptionId: ''
});

readAccessToken()

function readAccessToken(){
  try {
    fs.accessSync('token.dat');
    accessToken = fs.readFileSync('token.dat', 'utf8');
  }catch (e) {
    accessToken = ""
  }
}

function storeAccessToken(accessToken){
  fs.writeFile('token.dat', accessToken, function(err) {
    if(err)
      console.log(err)
  })
}

var bot = controller.spawn({});

controller.setupWebserver(process.env.port || 3000, function(err, webserver){
    controller.createWebhookEndpoints(webserver, bot,  function () {
        console.log("Online");
    });

    controller.createOauthEndpoints(webserver, bot, accessToken, function(err, req, res, token) {
        if(err) {
            res.status(500).send('ERROR: ' + err);
        } else {
            platform = controller.getRCPlatform();
            storeAccessToken(token);
            //res.send('Success!');
        }
    })

});

// Usage: uptime
controller.hears(['uptime'],'message_received',function(bot, message) {
    var hostname = os.hostname();
    var uptime = formatUptime(process.uptime());
    bot.reply(message,'I am a bot! I have been running for ' + uptime + ' on ' + hostname + '.');
    //console.log('Access Token =' + controller.configureGlipApp().accessToken);
});



////usage: pizzatime
//controller.hears(['pizzatime'],'message_received',function(bot,message) {
//    bot.startConversation(message, askFlavor);
//});

//var askFlavor = function(response, convo) {
//    convo.ask("What flavor of pizza do you want?", function(response, convo) {
//        convo.say("Awesome.");
//        askSize(response, convo);
//        convo.next();
//    });
//}
//var askSize = function(response, convo) {
//    convo.ask("What size do you want?", function(response, convo) {
//        convo.say("Ok.")
//        askWhereDeliver(response, convo);
//        convo.next();
//    });
//}
//var askWhereDeliver = function(response, convo) {
//    convo.ask("So where do you want it delivered?", function(response, convo) {
//        var message = null;
//        message = "Ordered large pizza by pawan\n\n"
//        message += "[Ticket ##1001](www.dominos.com) - ordered large pizza\n\n"
//        message += "**Description**\n\n"
//        message += "Ordered large cheese pizza & should delivered at home\n\n"
//        message += "**Priority**\n\n"
//        message += "asap\n"
//        convo.say(message);
//        convo.next();
//    });
//}


controller.hears(['give up'], 'message_received', function (bot, message) {
    bot.reply(message, "(╯'□')╯ ┻━┻ I'm done.");
});

controller.hears(['question (.*)'], 'message_received', function (bot, message) {
    var gemname, query1, query2;
    
    gemname = escape(message.match[1]).replace(/%20/g, "+");
    query1 = "http://api.wolframalpha.com/v1/result?i=" + gemname + "%3F&appid=PGAKAJ-U75WURKQ69";
    query2 = "http://api.wolframalpha.com/v2/query?input=" + gemname + "&format=plaintext&output=JSON&appid=PGAKAJ-U75WURKQ69";
    
    try{

        request({
            headers: {
                Accept: 'application/json'
            },
            uri: "" + query1,
            method: 'POST'
        }, function (err, res, body) {
            var error, match;
        
            match = /No short answer available/i.test("" + body) || /{}/i.test("" + body) || /No/i.test("" + body);
            console.log(body + '--------' + match);

            if (match) {
                console.log('No simple answer available, looking for a detailed one...');
                //bot.reply(message, query2);
                try{
                    lookfordetailedans(bot, message, query2, gemname);
                } catch (error) {
                    bot.reply(message,'Sorry, I got nothing');
                }
            }
            else {
                //bot.reply(message, query1);
                bot.reply(message, body);
            }

        });
    } catch (error) {
        console.log(error);
    }

});


function lookfordetailedans(bot, message, query2, gemname)
{  
    console.log('querying wolfram|alpha');

    return request(query2, function (err, response, body) {
        if ((err != null) || response.statusCode !== 200) {
            return callback(err, null);
        }
        var json = JSON.parse(body);
        var details = "";
        for (var i = 0; i < json.queryresult.numpods; i++) {
            details += "\n**" + json.queryresult.pods[i].title + "**";
            console.log("Pod " + i + " has " + json.queryresult.pods[i].numsubpods+" subpods ...")
            for (var j = 0; j < json.queryresult.pods[i].numsubpods; j++) {
                details+="\n " + json.queryresult.pods[i].subpods[j].plaintext;
            }
        }

        console.log(details);
        bot.reply(message, details);
        //console.log(body);
    });
}


function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
