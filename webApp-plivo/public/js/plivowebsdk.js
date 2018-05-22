/* Name: JsSIP Maintainer: José Luis Millán <jmillan@aliax.net> Copyright (c) 2012-2016 José Luis Millán <jmillan@aliax.net> License: The MIT License Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.*/
/*Copyright (c) 2013-2016, callstats.io All rights reserved.THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.*/

var Plivo = (function unpack(){var id=1, bundle=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
var Client = require('./client');

function Plivo(options) {
  var client  = new Client(options);

  Object.defineProperties(this, {
    client: {
      enumerable: true,
      value: client
    }
  });
}

module.exports = Plivo;
},{"./client":2}],2:[function(require,module,exports){
'use strict';

var SipLib;
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var constants = require('./util/constants');
var checkCodecPreference = require('./util/codecPreference');
var processSteams = require('./util/callAnalytics');
var Log = require('./util/logger');
var audioUtil = require('./media/audioDevice');
var documentUtil = require('./media/document');
var headersUtil = require('./util/headers');
var validateOptions = require('./util/validateOptions');

inherits(Client, EventEmitter);

function Client(options) {

  // Check for existing instance of Plivo object
  if(typeof window._PlivoInstance == "object"){
    Plivo.log.info("window.Plivo object and its instance already exist");
    return window._PlivoInstance;
  }

  if (!(this instanceof Client)) {
    return new Client(options);
  }
  
  var that = this;
  /*
    Default options flag
  */
  var _options = {
    codecs : constants.DEFAULT_CODECS,
    enableTracking : true,
    debug : "INFO",
    permOnClick: false,
    enableIPV6 :  false,
    audioConstraints : true,
    dscp : true,
    appId : null,
    appSecret : null,
    registrationDomainSocket : null,
    clientRegion : null,
    preDetectOwa: false,
    disableRtpTimeOut: false
  }
  /* 
    Default instance flags
  */
  this.permOnClick = false;
  this.ringToneFlag = true;
  this.ringToneBackFlag = true;
  this.connectToneFlag = true;
  this.isLoggedIn = false;

  // localstorage support in chrome extension and in browsers
  this.localStorage = (typeof chrome != 'undefined' && chrome.storage) ? chrome.storage.local : window.localStorage;
  // Initialise log in off mode and later setLevel
  this.log = new Log({enableDate:true,loggingName:'PlivoSDK',logMethod:"DEBUG"});
  Plivo.log = that.log;
  /*
    Validate all option we get
  */
  if (typeof options !== 'undefined') {
    /*
      Default option properties
    */
    for (var key in options){
      // On validation failure cases will use default _options
      switch (key){
        case "enableTracking" :
          if(validateOptions.isBoolean(key, options[key])){
            _options.enableTracking = options[key];
          }
          break;

        case "debug" :
          options[key] = options[key].toUpperCase(); // Convert log mode to all uppercase
          if(validateOptions.debug(options[key], constants.DEBUG_MODES)){
            _options.debug = options[key];
            if(options[key] == "ALL-PLAIN"){
              options[key] = "ALL"; // Since logger module does not support all-plain
            }
            that.log.setLevel(options[key]);
          }else{
            that.log.setLevel("INFO");
          }
          break;

        case "permOnClick" :
          if(validateOptions.isBoolean(key, options[key])){
            that.permOnClick = options[key];
            _options.permOnClick = options[key];
          }
          break;

        case "audioConstraints" :
          if(options[key]){
            _options.audioConstraints = options[key];
          }
          break;

        case "dscp" :
          if(validateOptions.isBoolean(key, options[key])){
            _options.dscp = options[key];
          }
          break;

        case "codecs" :
          if(validateOptions.codecs(options[key], constants.DEFAULT_CODECS) ){
            _options.codecs = options[key];
          }
          break;

        case "appSecret" :
          _options.appSecret = options[key];
          break;  

        case "appId" :
          _options.appId = options[key];
          break;

        case "registrationDomainSocket" :
          _options.registrationDomainSocket = options[key];
          break;

        case "enableIPV6" :
          break;

        case "clientRegion" :
          if(validateOptions.region(options[key], constants.REGION)){
            _options.clientRegion = options[key];
          }
          break;

        case "preDetectOwa" :
          if(validateOptions.isBoolean(key, options[key])){
            _options.preDetectOwa = options[key];
          }
          break;

        case "disableRtpTimeOut" :
          if(validateOptions.isBoolean(key, options[key])){
            _options.disableRtpTimeOut = options[key];
          }
          break;

        default :
          Plivo.log.warn('Ignoring invalid option key '+ key);
      }
    }
  }

  // sipLib logging will be based on localStorage.debug
  if ( ['ALL','ALL-PLAIN'].indexOf(_options.debug) != -1 ) {
    this.localStorage.debug = 'PlivoSIP:*';
    window._PlivoUseColorLog = true;
    // Turn of coloring in SIPlib console
    if(_options.debug == "ALL-PLAIN"){
      window._PlivoUseColorLog = false
    }
  } else {
    this.localStorage.debug = '';
  }

  //instantiates event emitter
  EventEmitter.call(this);

  // Init siplib
  SipLib = require('../sipLib/JsSIP');
  
  this.phone = null;
  this.callSession = null;
  this.callUUID = null;
  this.lastCallUUID = null;
  this.callDirection = null;
  this.callStats = null;
  this.userName = null;
  this.options = _options;
  this.audio = {
    availableDevices: audioUtil.availableDevices,
    ringtoneDevices: audioUtil.ringtoneDevices,
    microphoneDevices: audioUtil.inputDevices,
    speakerDevices: audioUtil.outputDevices,
    revealAudioDevices: audioUtil.revealAudioDevices
  }
  this.audioConstraints = this.options.audioConstraints; 
  this.browserDetails = SipLib.adapter.browserDetails;
  this.owaLastDetect = {time:0,isOneWay:true};
  this.owaDetectTime = 3600000;
  this.connStage = [];
  this.str = function(obj){
    return JSON.stringify(obj);
  }

  Plivo.audioConstraints = this.audioConstraints;
  Plivo.AppError = function(err,log){
    if (that.userName && that.callStats) {
      var confId;
      that.callUUID? (confId=that.callUUID) : (confId=that.userName);
      if(Object.prototype.toString.call(err) == "[object Object]"){
        err = JSON.stringify(err);
      }
      if(log){ // if its application log
        Plivo.log.debug('Call summary '+confId+'\n',err);
      }
      that.callStats.reportError(null, confId, that.callStats.webRTCFunctions.applicationLog, err);
    }
    return true;
  }

  //create document objects
  documentUtil.setup(that.options, function(evt) {
    if (!window.RTCPeerConnection) { // from adapter.js
      Plivo.log.error('No webRTC support');
      document.onreadystatechange = function(){
        document.readyState == "complete" && that.emit('onWebrtcNotSupported');
      }
    }
    that.emit('onMediaPermission',evt);
    if (evt.status == 'failure' && that.userName && that.callStats) {
      var errname = new DOMError("getUserMedia Error",  evt.error);
      that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.getUserMedia, errname);
    }
    if(evt.status == "success" && evt.stream){
      audioUtil.audioDevDictionary.call(that,true).then(function(){
        Plivo.log.debug('audioDevDictionary is updated onMediaPermission: '+evt.status);
      })
    }
    /*
      Save all audio ele ref
    */
    that.remoteView = document.getElementById(constants.REMOTE_VIEW_ID);
    that.ringToneView = document.getElementById(constants.RINGTONE_ELEMENT_ID);
    that.ringBackToneView = document.getElementById(constants.RINGBACK_ELEMENT_ID);
    that.connectToneView = document.getElementById(constants.CONNECT_TONE_ELEMENT_ID);

    Plivo.log.info('PlivoWebSdk initialized in ' + that.log.level() + ' mode, version: 2.0.13');
    // Show the options passed by developer
    Plivo.log.debug('PlivoWebSdk initialized with ',that.str(options));
    Plivo.log.info(that.str(that.browserDetails));
  });

  /*
    Audio Device change Event
  */
  navigator.mediaDevices.ondevicechange = function(e){
    audioUtil.checkAudioDevChange.call(that);
  }
  // pool for device change on chrome less than v57
  if(SipLib.adapter.browserDetails.browser == 'chrome' && SipLib.adapter.browserDetails.version < 57){
    setInterval(function(){
      audioUtil.checkAudioDevChange.call(that);
    },5000);
  }

  that.audioDevDic = null;
  audioUtil.audioDevDictionary.call(this,true);

  // store this instance as window object
  window._PlivoInstance = this;
}

Client.prototype.login = function(userName, password) {
  if (typeof userName === 'undefined' || typeof password === 'undefined' || userName === null || password === null && (userName.length <= 0 || password.length <= 0)) {
    Plivo.log.error('username & password cant be null');
    this.emit('onLoginFailed', 'Username and password must be filled out');
    return false;
  }
  // On login failure retry.
  if(this.phone){
    this.phone.stop();
    delete this.phone;
    Plivo.log.debug('deleting the existing phone instance');
  }

  // look for custom domain in init options
  if(this.options.registrationDomainSocket)
    constants.WS_SERVERS = this.options.registrationDomainSocket;

  var plivoSocket = new SipLib.WebSocketInterface(constants.WS_SERVERS);
  var sipConfig = {
    'sockets'        : [plivoSocket],
    'register_expires': constants.REGISTER_EXPIRES_SECONDS,
    'uri': userName + '@' + constants.DOMAIN,
    'password': password,
    'googIPv6': this.enableIPV6 || false,
    'connection_recovery_max_interval': constants.WS_RECOVERY_MAX_INTERVAL,
    'connection_recovery_min_interval': constants.WS_RECOVERY_MIN_INTERVAL,
    'session_timers' : false
  };

  try {
    this.phone = new SipLib.UA(sipConfig);
  } catch (e) {
    Plivo.log.debug('Failed to create user agent' + e);
    return false;
  }

  Plivo.log.info('Ready to login');

  var that = this;

  var lastConnectionChangeTime = 0;
  //connected event fired by UA.js
  this.phone.on('connected', function (evt) {
    Plivo.log.info('websocket connection established', evt);
    // clear the lastConnectionChangeTime, reset for next network disruption
    lastConnectionChangeTime = 0 ;
  });

  // disconnected event fired by UA.js
  this.phone.on('disconnected', function (evt) {
    Plivo.log.info('websocket connection closed' , evt);

    if(evt && evt.code>1000){ 
    // 1000 is normal websocket closed event , others codes as 1003,1006,1011 etc are for abnormal termination
      var eventData = { "state": evt.code , "status" :  evt.reason || "Websocket Disconnected"};
      //Adding a timeout for notifying connection change event every 5 seconds
      if(lastConnectionChangeTime == 0 ){
        // First Time Event , dont wait to show notification 
        that.emit('onConnectionChange', eventData);
        lastConnectionChangeTime = new Date();
      }else{
        var currentConnectionChangeTime = new Date();
        // Wait 10 seconds to emit the connection change event
        if( ( ( currentConnectionChangeTime - lastConnectionChangeTime )/1000) > 10 ){
          that.emit('onConnectionChange', eventData);
          lastConnectionChangeTime = new Date();
        }
      }
    }
  });

  this.phone.on('registered', function () {
    that.userName = userName;
    if(that.isLoggedIn === false) {
      that.isLoggedIn = true;
      that.emit('onLogin');
      Plivo.log.debug('logged in');

      if(that.options.enableTracking && !that.callStats) {
        that.options.appId? null : (that.options.appId = "380077084");
        // Temp fix for chrome 58 to get callback based getstats
        window.csioChromeLegacyGetStats=true;

        that.callStats = new callstats();
        var configParams = {
          disableBeforeUnloadHandler: false, // disables callstats.js's window.onbeforeunload parameter.
          applicationVersion: '2.0.13' // Application version specified by the developer.
        };
        // callbacks for callstats
        var csInitCallback = function(err, msg) {
          Plivo.log.debug('Stats Initializing Status: err= '+err + ' msg= '+msg);
        };
        var csStatsCallback = function(stats){
          var streams = stats.streams;
          processSteams.call(that,_emitter, streams);
          if(window._PlivoDevLogging){
            console.log(streams);
          }
        }
        // callstats initialize
        if(SipLib.adapter.browserDetails.browser != 'chrome')
          csStatsCallback = null; //still some issues in FF so don't go for getstats call back
        /**
          if appSecret is passed in option use it. Usefull if customer has their own callstats account
          Or try to get token for appId
        */
        if(that.callStats) {
          var callStatsToken = that.options.appSecret || callStatsTokenCb(that);
          that.callStats.initialize(that.options.appId, callStatsToken, userName, csInitCallback, csStatsCallback, configParams);
        }
        Plivo.log.debug('enableTracking initialized');
      }
    }
  });

  this.phone.on('unregistered', function () {
    Plivo.log.debug('Plivo client logged out');
    that.isLoggedIn = false;

    that.ringToneView.paused? null: documentUtil.stopAudio(constants.RINGTONE_ELEMENT_ID);
    that.ringBackToneView.paused? null: documentUtil.stopAudio(constants.RINGBACK_ELEMENT_ID);
    that.userName = null;

    that.emit('onLogout');
  });

  this.phone.on('registrationFailed', function(error) {
    that.isLoggedIn = false;
    Plivo.log.debug('Login failed : ',error.cause);
    that.userName = null;  
    that.emit('onLoginFailed', error.cause);
  });

  this.phone.on('newRTCSession', function (evt) {
    Plivo.log.debug('new rtc session');
    if(that.callSession && that.callSession.connection.signalingState == 'closed'){
      Plivo.log.warn("Previous call doesn't end properly");
      that.callSession = null;
    }
    if (that.callSession) {
      Plivo.log.debug('Already on call, sending busy signal.');

      var opts = {
        'status_code': 486,
        'reason_phrase': 'Busy Here'
      };

      evt.session.terminate(opts);
      return;
    }

    that.callSession = evt.session;

    if (evt.originator === 'remote') {
      that.callDirection = 'incoming';
      Plivo.log.info('<----- INCOMING ----->');
      that.connStage = [];
      that.connStage.push('I-invite@'+dateMs());

      that.callUUID = evt.request.getHeader('X-Calluuid') || null;
      var caller = evt.request.getHeader('From');
      that.caller = caller.match(/:(.*)@/i)[1];
      
      //custom sdp codec changes
      try{
        evt.request.body = checkCodecPreference(that.options.codecs, evt.request.body);  
      }catch(err){
        Plivo.log.debug('checkCodecPreference err - ',err);
      }
      

      that.callSession.on('progress', function (evt) {
        Plivo.log.debug('Incoming call progress');
        that.connStage.push('progress-180@'+dateMs());
        var callerUri = that.callSession.remote_identity.uri.toString();
        if(that.ringToneFlag !== false) {
          Plivo.log.debug('ringtone enabled : ',that.ringToneFlag);
          documentUtil.playAudio(constants.RINGTONE_ELEMENT_ID);
        }
        that.emit('onIncomingCall', callerUri.substring(4, callerUri.indexOf('@')) + '@'+constants.DOMAIN, extraHeaders);  
        Plivo.log.debug('Incoming Call Extra Headers : ',extraHeaders);        
      });
      
      that.callSession.on('sdp', function(evt){
        Plivo.log.debug('Incoming call SDP processing done');
      });

      that.callSession.on('accepted', function(evt){
        Plivo.log.info('Incoming call accepted');

        callStart(that); // initialise callstats storage.
        var inboundConn = that.callSession.connection || null;
        inboundConn.oniceconnectionstatechange = function(evt){
          var iceState = inboundConn.iceConnectionState;
          Plivo.log.debug('oniceconnectionstatechange:: '+iceState);
          that.connStage.push("iceConnectionState-"+iceState+"@"+dateMs());
          //Notify network drops
          iceConnectionCheck.call(that,iceState);
          if (that.callStats && that.callUUID &&  inboundConn) {
             if (iceState == 'failed' || iceState == 'disconnected') {
                var errname = new DOMError(iceState, iceState);
                that.callStats.reportError(inboundConn, that.callUUID, that.callStats.webRTCFunctions.iceConnectionFailure, errname);
             }
          }
        }
      });

      that.callSession.on('confirmed', function (evt) {
        Plivo.log.debug('Incoming call confirmed - '+that.callUUID);
        that.connStage.push("confirmed@"+dateMs());

        // disableRtpTimeOut if enabled
        if(that.options.disableRtpTimeOut){
          that.callSession.connection.disableRtpTimeOut = true;
        }

        var remoteStream = this.connection.getRemoteStreams()[0];
        if(!remoteStream){
          Plivo.log.error('Incoming call remoteStream does not exists');
        }
        that.remoteView.srcObject = remoteStream;

        var peerConnectionCallback = function(message) {
          Plivo.log.debug('Stats new fabric message: ' + message);
        };
        //peer connection is established till here on incoming
        if (that.callStats && this.connection) {
          that.callStats.addNewFabric(this.connection, that.caller, that.callStats.fabricUsage.audio, that.callUUID, peerConnectionCallback);
        }
        that.ringToneView.paused? null : documentUtil.stopAudio(constants.RINGTONE_ELEMENT_ID);
        that.ringBackToneView.paused? null : documentUtil.stopAudio(constants.RINGBACK_ELEMENT_ID);

        that.emit('onCallAnswered');
        Plivo.log.debug("Plivo Event: Post-Answer detecting OWA");
        setTimeout(owaNotification, 3000, this.connection, that);
      });

      that.callSession.on('icetimeout', function(sec){
        Plivo.log.debug('iceGathering timed out');
        _emitter(that,'network','warning','ice_timeout', sec, true, "Possible NAT/Firewall issue");
      });

      that.callSession.on('failed', function(evt) {
        Plivo.log.error('Call failed: ' + evt.cause);
        that.connStage.push("failed@"+dateMs());

        that.ringToneView.paused? null:documentUtil.stopAudio(constants.RINGTONE_ELEMENT_ID);
        if (evt.cause == SipLib.C.causes.CANCELED && that.callDirection == 'incoming') {
          that.emit('onIncomingCallCanceled');
        }
        else {
          that.emit('onCallFailed', evt.cause);
        }

        if (that.callStats && that.callUUID && this.connection && !evt.cause.match('edia')) { // media err is not under signaling err
          var errName,errMsg;
          if (evt.message) {
            errName = evt.cause;
            errMsg = errName;
            evt.message.status_code && (errMsg = String(evt.message.status_code) );
          }
          var errname = new DOMError(errName, errMsg);
          Plivo.log.debug(errname);
          that.callStats.reportError(this.connection, that.callUUID, that.callStats.webRTCFunctions.signalingError, errname);
        }
        hangupClearance(that);
      });

      that.callSession.on('ended', function (evt) {
        Plivo.log.debug('Incoming call ended - '+that.callUUID);
        Plivo.log.info('Incoming call ended');
        that.connStage.push("ended@"+dateMs());

        if (that.callStats) {
          that.callStats.sendFabricEvent(this.connection, that.callStats.fabricEvent.fabricTerminated, that.callUUID);
        }
        that.emit('onCallTerminated',{"originator":evt.originator, "reason":evt.cause});
        hangupClearance(that);
      });
      that.callSession.on('getusermediafailed', function(err){
        Plivo.log.error('getusermediafailed: '+err);
        if (that.userName && that.callStats) {
          err.message = "getusermediafailed";
          that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.getUserMedia, err);
        }
      });
      that.callSession.on('peerconnection:createofferfailed', function(err){
        Plivo.log.error('peerconnection:createofferfailed: ',err);
        if (that.userName && that.callStats) {
          err.message = "peerconnection:createofferfailed";
          that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.createOffer, err);
        }      
      });
      that.callSession.on('peerconnection:createanswerfailed', function(err){
        Plivo.log.error('peerconnection:createanswerfailed: ', err);
        if (that.userName && that.callStats) {
          err.message = "peerconnection:createanswerfailed";
          that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.createAnswer, err);
        }      
      });
      that.callSession.on('peerconnection:setlocaldescriptionfailed', function(err){
        Plivo.log.error('peerconnection:setlocaldescriptionfailed: ', err);
        if (that.userName && that.callStats) {
          err.message = "peerconnection:setlocaldescriptionfailed";
          that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.setLocalDescription, err);
        }
      });
      that.callSession.on('peerconnection:setremotedescriptionfailed', function(err){
        Plivo.log.error('peerconnection:setremotedescriptionfailed: ',err);
        if(err.message && !err.message == 'pranswer not yet implemented'){
          if (that.userName && that.callStats) {
            that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.setRemoteDescription, err);
          }        
        }
      });      

      var request = evt.request;
      var headers = request.headers;
      var extraHeaders = headersUtil.receiveExtraHeader(request, headers);

      Plivo.log.debug('callSession - '+ that.callUUID);
      
    } else {
      that.callDirection = 'outgoing';
      Plivo.log.debug('new RTCSession outgoing');
      that.emit('onCalling');
    }
  });

  this.phone.start();

  return true;
};

Client.prototype.logout = function() {
  Plivo.log.debug('logout() triggered!');
  if (this.callSession) {
    Plivo.log.debug('Terminating an active call');
    this.callSession.terminate();
  }
  this.connStage.push("logout()@"+dateMs());
  this.phone && this.phone.stop();
  this.emit('onLogout');
  return true;
};

Client.prototype.call = function(phoneNumber, extraHeaders) {
  var that = this;
  Plivo.log.info('<----- OUTGOING ----->');
  that.connStage = [];
  Plivo.log.info('Outgoing call initialized to : '+ phoneNumber);
  if (!this.isLoggedIn) {
    Plivo.log.warn('Must be logged in before make a call');
    return false;
  }
  that.connStage.push("call()@"+dateMs());  
  
  function onCallFailed(reason){
    that.emit('onCallFailed', reason);
    return true;
  }
  function readyForCall(){
    that.owaLastDetect.isOneWay=false;
    return _createSession(that, extraHeaders, phoneNumber);
  }
  /** 
    Handle one way audio issues in chrome
    check for every 1 hr
  */
  if(that.options.preDetectOwa && that.browserDetails.browser == "chrome" && ( (new Date() - that.owaLastDetect.time) > that.owaDetectTime || that.owaLastDetect.isOneWay) ){
    detectOWA(function(res, err){  // @res {"bytesSent ": "366", audioInputLevel: "117"}
      that.owaLastDetect.time = new Date();
      if(err){
        Plivo.log.error('Error in detecting microphone status ',err);
        that.emit('onMediaPermission',{"status":"failure","error":err.name});
        onCallFailed('media - '+err.name);
        return false;
      }else{
        Plivo.log.debug('getUserMedia precheck ',res);
        if( Number(res.bytesSent) == 0 && Number(res.audioInputLevel) == 0 ){
          _emitter(that,'audio','warning','no_microphone_access', 0, true, "chrome lost access to microphone - restart browser");
          that.owaLastDetect.isOneWay=true;
          onCallFailed('no_microphone_access');
          return false;
        }        
        if( Number(res.audioInputLevel) == 0 ){
          _emitter(that,'audio','warning','no_microphone_access', 0, true, "microphone is muted");
        }
      }
      // On no one way audio go to call ready mode
      readyForCall();
    });    
  }else{
    // Browsers other than chrome go to call ready mode
    readyForCall();
  }
}

Client.prototype.answer = function() {
  Plivo.log.debug('answer - '+ this.callUUID);
  var that = this;
  var opts = {}; 

  if (this.callSession) {
    that.connStage.push("answer()@"+dateMs());

    function mediaError(reason){
      that.reject();
      return true;
    }
    function readyForCall(){
      that.owaLastDetect.isOneWay=false;
      opts.pcConfig = {
        'iceServers': [
          { 'urls': constants.STUN_SERVERS }
        ]
      };
      if(that.permOnClick){
          var audioConstraints = that.options.audioConstraints || true;
          opts.mediaConstraints = {
            audio: audioConstraints,
            video: false
          };        
      }else{
        window.localStream? true : Plivo.log.warn('no localStream attached for this call');     
      }
      opts.mediaStream = window.localStream || null;
      opts.rtcConstraints = that.options.dscp? ({"optional":[{"googDscp":true}]}) : null;
      opts.sessionTimersExpires = constants.SESSION_TIMERS_EXPIRES;      
      try{
        if(that.callSession){
          that.callSession.answer(opts);
        }
      }catch(err){
        Plivo.log.error('error in answering : ',err);
        that.emit('onIncomingCallCanceled',err);
      }
      that.ringToneView.paused? null : documentUtil.stopAudio(constants.RINGTONE_ELEMENT_ID);       
      return true;    
    }
    /** 
      Handle One way audio issues for outgoing call in chrome
      check for every 1 hr
    */
    if(that.options.preDetectOwa && that.browserDetails.browser == "chrome" && ( (new Date() - that.owaLastDetect.time) > that.owaDetectTime || that.owaLastDetect.isOneWay) ){
      detectOWA(function(res, err){  // @res {"bytesSent ": "366", audioInputLevel: "117"}
        that.owaLastDetect.time = new Date();
        if(err){
          Plivo.log.error('Error in detecting microphone status ',err);
          that.emit('onMediaPermission',{"status":"failure","error":err.name});
          mediaError('media - '+err.name);
          return false;
        }else{
          Plivo.log.debug('getUserMedia precheck ',that.str(res));
          if( Number(res.bytesSent) == 0 && Number(res.audioInputLevel) == 0){
            _emitter(that,'audio','warning','no_microphone_access', 0, true, "chrome lost access to microphone - restart browser");
            that.owaLastDetect.isOneWay=true;
            mediaError('no_microphone_access');
            return false;
          }
          if( Number(res.audioInputLevel) == 0 ){
            _emitter(that,'audio','warning','no_microphone_access', 0, true, "microphone is muted");
          }          
        }
        // On no one way audio go to call ready mode
        readyForCall();
      });    
    }else{
      // Browsers other than chrome go to call ready mode
      readyForCall();
    }

  } else {
    Plivo.log.error('Incoming call answer() failed : no incoming call');
    return false;
  }
  return true;
};

Client.prototype.hangup = function () {
  Plivo.log.debug('hangup - '+this.callUUID);
  if (this.callSession) {
    if(this.callSession.direction != "outgoing" && !isSessionConfirmed(this.callSession)){
      Plivo.log.warn('use of hangup() on unanswered call is deprecated. use reject() instead');
    }
    try{
      Plivo.log.info('hangup initialized');
      Plivo.AppError({"name":"hangup","message":"hangup initialized","method":"hangup()"});
      this.callSession.terminate();
      this.ringBackToneView.paused? null: documentUtil.stopAudio(constants.RINGBACK_ELEMENT_ID);
    }catch(err){
      Plivo.log.error('Could not hangup reason : ',err);
      Plivo.AppError({"name":err.name,"message":err.message,"method":"hangup()"});
    }
  }
  else {
    Plivo.log.warn('No call session exists to hangup');
    return false;
  }
  return true;
};

Client.prototype.reject = function () {
  Plivo.log.debug('reject - '+this.callUUID);
  if(!this.callSession){
    Plivo.log.warn('No call session exists to reject()');
    return false;    
  }
  if(isSessionConfirmed(this.callSession)){
    Plivo.log.warn('call already answerd, please use hangup() method');
    return false;
  }
  if (this.callSession) {
    var opts = {
      'status_code': 486,
      'reason_phrase': 'Busy Here'
    };
    Plivo.log.info('rejecting call');
    Plivo.AppError({"name":"reject","message":"reject initialized","method":"reject()"});
    try{
      this.callSession.terminate(opts);
    }catch(err){
      Plivo.log.error('error in rejecting call : ',err);
      Plivo.AppError({"name":err.name,"message":err.message,"method":"reject()"});
    }
    this.ringToneView.paused? null: documentUtil.stopAudio(constants.RINGTONE_ELEMENT_ID);
    return true;
  }
}

Client.prototype.sendDtmf = function (digit) {
  Plivo.log.debug('sendDtmf - '+this.callUUID);
  if (typeof digit == 'undefined' || digit == null) {
    return Plivo.log.warn('DTMF digit can not be null');
  } else if (typeof constants.DTMF_TONE_FLAG[digit] == 'undefined') {
    return Plivo.log.warn(digit + ' is not a valid DTMF digit');
  }

  if (this.callSession) {
    try {
      Plivo.log.debug('sending dtmf digit '  + digit);
      this.callSession.sendDTMF(digit);
      if (digit === '*') {
        return documentUtil.playAudio('dtmfstar');
      } else if (digit === '#') {
        return documentUtil.playAudio('dtmfpound');
      }
      return documentUtil.playAudio('dtmf' + digit);
    } catch (err) {
      Plivo.log.error('Call has not been confirmed cannot send DTMF');
      Plivo.AppError({"name":err.name,"message":err.message,"method":"sendDtmf()"});
    }
  } else {
    Plivo.log.warn('No call session exists to sendDtmf');
  }

};

Client.prototype.mute = function () {
  if (this.callSession) {
    Plivo.log.debug('mute called');
    try{
      this.callSession.mute();
      if (this.callStats) {
        this.callStats.sendFabricEvent(this.callSession.connection, this.callStats.fabricEvent.audioMute, this.callUUID);
      }     
    }catch(err){
      Plivo.log.error('error in mute :',err);
      Plivo.AppError({"name":err.name,"message":err.message,"method":"mute()"});
    }

  } else {
    Plivo.log.warn('No call session exists to mute');
    return false;
  }

  return true;
};

Client.prototype.unmute = function () {
  if (this.callSession) {
    Plivo.log.debug('unmute called');
    try{
      this.callSession.unmute();
      if (this.callStats) {
        this.callStats.sendFabricEvent(this.callSession.connection, this.callStats.fabricEvent.audioUnmute, this.callUUID);
      }
    }catch(err){
      Plivo.log.error('error in unmute : ',err);
      Plivo.AppError({"name":err.name,"message":err.message,"method":"unmute()"});
    }
  } else {
    Plivo.log.warn('No call session exists to unmute');
    return false;
  }

  return true;
};

Client.prototype.setRingTone = function (val) {
  if (val === false || val === null) {
    this.ringToneFlag = false;
  }
  else if (typeof val === 'string') {
    this.ringToneFlag = 'user';

    Plivo.log.debug('setRingTone() url : '+val);

    this.ringToneView.src = val;
  }
  else {
    this.ringToneFlag = true;
  }
  return true;
};

Client.prototype.setRingToneBack = function (val) {
  if (val === false || val === null) {
    this.ringToneBackFlag = false;
  }
  else if (typeof val == 'string') {
    this.ringToneBackFlag = 'user';
    Plivo.log.debug('setRingToneBack() url : '+val);
    this.ringBackToneView.src = val;
  }
  else {
    this.ringToneBackFlag = true;
  }

  return true;
};

Client.prototype.setConnectTone = function (val) {
  if (!val) {
    this.connectToneFlag = false;
  }
  else {
    this.connectToneFlag = true;
  }
  return true;
};

Client.prototype.setDtmfTone = function (digit, url) {
  if (url === false || url === null) {
    constants.DTMF_TONE_FLAG[digit] = false;
  }
  else if (typeof url === 'string') {
    Plivo.log.debug('set dtmf tone');
    constants.DTMF_TONE_FLAG[digit] = 'user';
    var elementName = 'dtmf' + digit;
    var element = document.getElementById(elementName);

    element.src = url;
  }
  else {
    constants.DTMF_TONE_FLAG[digit] = true;
  }

  return true;
};

Client.prototype.getCallUUID = function () {
  return this.callUUID;
};

Client.prototype.getLastCallUUID = function(){
  return this.lastCallUUID;
}
Client.prototype.setDebug = function (debug) {
  if(debug && ['INFO','DEBUG','WARN','ERROR','ALL','OFF'].indexOf(debug) != -1){
    Plivo.log.setLevel(debug);
  }
};

Client.prototype.getPeerConnection = function (){
  if (this.callSession && isSessionConfirmed(this.callSession)){
    return {"status":"success", "pc":this.callSession.connection }; 
  }else{
    return {"status":"called in wrong state", "pc":null};
  }
}

Client.prototype.version = '2.0.13';

Client.prototype.webRTC = function(){
  return window.RTCPeerConnection? true : false;
}

Client.prototype.supportedBrowsers = function(){
  return "Chrome, Firefox";
}

Client.prototype.sendQualityFeedback = function (callUUID, score, comment) {
  var score = Number(score);
  /* handle all failures  */
  if(!this.callStats){
    Plivo.log.warn('Stats integration not configured, ignoring feedback');
    return;
  }
  // On logout don't allow to sendQuality fb
  if(!this.userName){
    Plivo.log.error('sendQualityFeedback() userName is null, isLoggedIn : ' + this.isLoggedIn);
    return;
  }
  if(!callUUID){
    Plivo.log.error('sendQualityFeedback() callUUID is mandatory');
    return;
  }
  if(comment && comment.toString().length > 200){
    Plivo.log.error('sendQualityFeedback() comment max length is 200 character');
    return;
  }
  if(!comment){
    Plivo.log.error('sendQualityFeedback() comment is mandatory')
  }
  /* Success */
  if( score > 0 && score <= 5){  // consider scores between 1-5
    var feedback ={
      userID: this.userName,
      overall: score,
      comment: comment
    };
    var pcCallback = function(message) {
        Plivo.log.debug('Stats sendFeedback status: ' + message);
    };
    Plivo.log.debug('Feedback sent for callUUID : '+callUUID);
    this.callStats.sendUserFeedback(callUUID, feedback, pcCallback);
  }else{
    Plivo.log.error('sendQualityFeedback() score: '+score+' , score should be from 1-5 range');
  }
};

var owaNotification = function(connection, that) {
  if (connection && connection.signalingState != "closed" && SipLib.adapter.browserDetails.browser == "chrome") {
      var pc = connection;
      pc.getStats(function (res) {
              res.result().forEach(function(result) {
                  var report = result;
                  report.stat('bytesSent') && Plivo.log.debug("Bytes sent by WebSDK client: " + report.stat('bytesSent') + " audioInputLevel: " +report.stat('audioInputLevel'));
                  that.storage.audioCodec = report.stat("googCodecName"); // store audio codec
                  if (report.type === 'ssrc' && report.stat('mediaType') === 'audio' && parseInt(report.stat('bytesSent'), 10) === 0 && report.stat('audioInputLevel') === 0) {
                    Plivo.log.debug("One way audio detected");
                    _emitter(that,'audio','warning','no_microphone_access', 0, true, "no access to your microphone");
                  }
              });
      },pc.getLocalStreams()[0].getAudioTracks()[0],function(err){console.log(err);});
  }
};

var _emitter = function(ClientInstance, group, level, type, value, active,desc){
  var msgTemplate = { "group":group,
                      "level":level,
                      "type":type,
                      "value":value,
                      "active":active,
                      "desc":desc || ""
                    };
  ClientInstance.emit('mediaMetrics', msgTemplate);
};

var _createSession = function(that, extraHeaders, phoneNumber) {
  var opts = {};
  var destinationUri;
  
  if(phoneNumber){
    phoneNumber = String(phoneNumber);
  }
  
  if (typeof phoneNumber === 'undefined' || phoneNumber === null || phoneNumber.length <= 0) {
    Plivo.log.warn('Destination address cant be null and its length must be > 0');
    return false;
  }

  if (that.callSession) {
    Plivo.log.warn("Can't make another call while in call");
    return false;
  }

  extraHeaders = extraHeaders || {}; 
  var cleanExtraHeaders = [];

  for (var key in extraHeaders) {
    var value = extraHeaders[key];
    if (headersUtil.checkExtraHeaderKey(key) && headersUtil.checkExtraHeaderVal(value)) {
      cleanExtraHeaders.push(key + ': ' + value);
      Plivo.log.debug('valid hdr = ' + key + ' -> ' + value);
    } else {
      Plivo.log.debug('invalid hdr = ' + key + ' -> ' + value);
    }
  }
  // client route region
  if(that.options.clientRegion){
    cleanExtraHeaders.push("X-ClientRegion: "+that.options.clientRegion);
  }

  if (phoneNumber.substring(0, 4) != 'sip:') {
    destinationUri = 'sip:' + phoneNumber;
  } else {
    destinationUri = phoneNumber;
  }
  opts.sessionTimersExpires = constants.SESSION_TIMERS_EXPIRES;

  opts.pcConfig = {
    'iceServers': [
      { 'urls': constants.STUN_SERVERS }
    ]
  };

  var audioConstraints = that.options.audioConstraints || true;
  opts.mediaConstraints = {
    audio: audioConstraints,
    video: false
  };
  opts.rtcConstraints =  that.options.dscp? ({"optional":[{"googDscp":true}]}) : null;
  opts.extraHeaders = cleanExtraHeaders;
  opts.mediaStream = window.localStream || null;

  opts.eventHandlers = {
    'sending': function (evt) {
      Plivo.log.debug('Outgoing call sending');
      that.connStage.push('O-invite@'+dateMs());
      var outboundConn = this.connection || null;
      if(that.connectToneFlag !== false){
        documentUtil.playAudio(constants.CONNECT_TONE_ELEMENT_ID);
      }
      
      //Adding remote stream
      outboundConn.ontrack = function(evt){
        Plivo.log.debug('Outgoing call received addStream');
        that.connStage.push("addStream-success@"+dateMs());
        if(evt.streams[0]){
          /// on direct 200 OK with out 18x, we get The play() request was interrupted by a new load request. 100 timeout sec is workaround
          setTimeout(function(){
            that.remoteView.srcObject = evt.streams[0];
          },100);
          if(that.ringToneBackFlag && !isSessionConfirmed(that.callSession)){
            setTimeout(function(){
              if (!isSessionConfirmed(that.callSession)) {
                that.remoteView.pause();
              }
            },100)
          }else if(!that.ringToneBackFlag && !isSessionConfirmed(that.callSession)){
            Plivo.log.debug('playAudio - MediaServer');
          }
        }else{
          Plivo.log.error('Outgoing call addStream failure');
          that.connStage.push("addStream-failure@"+dateMs());
        }
      };
      outboundConn.oniceconnectionstatechange = function(){
        var iceState = outboundConn.iceConnectionState;
        Plivo.log.debug('oniceconnectionstatechange:: '+iceState);
        that.connStage.push("iceConnectionState-"+iceState+"@"+dateMs());
        //Notify network drops
        iceConnectionCheck.call(that,iceState);
        if (that.callStats && that.callUUID &&  outboundConn) {
           if (iceState == 'failed' || iceState == 'disconnected') {
              Plivo.log.debug('iceState :: '+iceState)
              var errname = new DOMError(iceState, iceState);
              that.callStats.reportError(outboundConn, that.callUUID, that.callStats.webRTCFunctions.iceConnectionFailure, errname);
           }
        }
      }
    },
    'sdp': function(evt){
      try{
        evt.sdp = checkCodecPreference(that.options.codecs, evt.sdp);
      }catch(err){
        Plivo.log.debug('checkCodecPreference err - ',err);
      }
        
    },
    'progress': function (evt) {

      that.callSession = this;
      that.callUUID = evt.response.getHeader('X-Calluuid');
      that.emit('onCallRemoteRinging');

      if (that.callStats && this.connection) {
        var peerConnectionCallback = function(message) {
          Plivo.log.debug('Stats new fabric message: ' + message);
        };
        var dest = this.request.headers.To.toString().match(/:(.*)@/i)[1];
        that.callStats.addNewFabric(this.connection, dest, that.callStats.fabricUsage.audio, that.callUUID, peerConnectionCallback);
      }

      that.connStage.push("progress-"+evt.response.status_code+"@"+dateMs());
      Plivo.log.debug('Outgoing call progress',evt.response.status_code);
      Plivo.log.debug('ringback tone enabled : '+that.ringToneBackFlag);
      // Stop connect tone on 18x response
      that.connectToneView.paused? null: documentUtil.stopAudio(constants.CONNECT_TONE_ELEMENT_ID);
      
      if(that.ringToneBackFlag){
        documentUtil.playAudio(constants.RINGBACK_ELEMENT_ID);
      }

      if(evt.response.status_code == 183 && evt.response.body){
        Plivo.log.debug('callSession - '+that.callUUID);
        // ringback tone is not enabled then use media server ringback tone
        if(!that.ringToneBackFlag){
          that.ringBackToneView.paused? null : documentUtil.stopAudio(constants.RINGBACK_ELEMENT_ID);
          return;
        }
      }

    },
    'accepted': function (evt) {
      var dest = evt.response.getHeader('To').match(/:(.*)@/i)[1];
      that.callUUID = evt.response.getHeader('X-Calluuid');
      Plivo.log.info('Outgoing call accepted');

      var peerConnectionCallback = function(message) {
       Plivo.log.debug('Stats new fabric message: ' + message);
      };

      callStart(that);
      if (that.callStats && this.connection) {
       that.callStats.addNewFabric(this.connection, dest, that.callStats.fabricUsage.audio, that.callUUID, peerConnectionCallback);
      }
    },
    'confirmed': function (evt) {
      Plivo.log.debug('Outgoing call confirmed - '+ that.callUUID);
      that.connStage.push('confirmed@'+dateMs());
      that.remoteView.paused && that.remoteView.play();
      //disableRtpTimeOut if enabled
      if(that.options.disableRtpTimeOut){
        that.callSession.connection.disableRtpTimeOut=true;
      }
      that.ringToneView.paused? null : documentUtil.stopAudio(constants.RINGTONE_ELEMENT_ID);
      that.ringBackToneView.paused? null : documentUtil.stopAudio(constants.RINGBACK_ELEMENT_ID);
      that.connectToneView.paused? null : documentUtil.stopAudio(constants.CONNECT_TONE_ELEMENT_ID);

      that.emit('onCallAnswered');
      setTimeout(owaNotification, 3000, this.connection, that);
    },
    'icetimeout': function(sec){
      Plivo.log.debug('iceGathering timed out');
      _emitter(that,'network','warning','ice_timeout', sec, true, "Possible NAT/Firewall issue");
    },
    'failed': function (evt) {
      Plivo.log.error('Outgoing call failed: ' + evt.cause);
      that.connStage.push('failed@'+dateMs());
      that.ringBackToneView.paused? null : documentUtil.stopAudio(constants.RINGBACK_ELEMENT_ID);
      that.connectToneView.paused? null : documentUtil.stopAudio(constants.CONNECT_TONE_ELEMENT_ID);

      if(evt.message) {
        that.callUUID = evt.message.getHeader('X-CallUUID')||null;
      }

      if (that.callStats && that.callUUID && !evt.cause.match('edia')) { // dont pass media errors as signalling err
        var errName=evt.cause,errMsg=errName;
        if (evt.message) {
          evt.message.status_code && (errMsg = String(evt.message.status_code) );
        }

        var errname = new DOMError(errName, errMsg);
        Plivo.log.debug(errname);
        that.callStats.reportError(null, that.callUUID, that.callStats.webRTCFunctions.signalingError, errname);
      }

      that.emit('onCallFailed', evt.cause);
      hangupClearance(that);
    },    
    'ended': function (evt) {
      Plivo.log.debug('Outgoing call ended - '+that.callUUID);
      Plivo.log.info('Outgoing call ended');
      that.connStage.push('ended@'+dateMs());

      if (that.callStats) {
        that.callStats.sendFabricEvent(this.connection, that.callStats.fabricEvent.fabricTerminated, that.callUUID);
      }
      that.emit('onCallTerminated',{"originator":evt.originator, "reason":evt.cause});
      Plivo.AppError({"name":"onCallTerminated","originator":evt.originator,"reason":evt.cause});
      hangupClearance(that);
    },
    'getusermediafailed': function(err){
      Plivo.log.error('getusermediafailed: '+err);
      if (that.userName && that.callStats) {
        err.message = "getusermediafailed";
        that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.getUserMedia, err);
      }
    },
    'peerconnection:createofferfailed': function(err){
      Plivo.log.error('peerconnection:createofferfailed: ',err);
      if (that.userName && that.callStats) {
        err.message = "peerconnection:createofferfailed";
        that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.createOffer, err);
      }
    },
    'peerconnection:createanswerfailed': function(err){
      Plivo.log.error('peerconnection:createanswerfailed: ', err);
      if (that.userName && that.callStats) {
        err.message = "peerconnection:createanswerfailed";
        that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.createAnswer, err);
      }      
    },
    'peerconnection:setlocaldescriptionfailed': function(err){
      Plivo.log.error('peerconnection:setlocaldescriptionfailed: ', err);
      if (that.userName && that.callStats) {
        err.message = "peerconnection:setlocaldescriptionfailed";
        that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.setLocalDescription, err);
      }
    },
    'peerconnection:setremotedescriptionfailed': function(err){
      if(err.message && !/pranswer/.test(err.message)){
        Plivo.log.error('peerconnection:setremotedescriptionfailed: ',err);
        if (that.userName && that.callStats) {
          err.message = "peerconnection:setremotedescriptionfailed";
          that.callStats.reportError(null, that.userName, that.callStats.webRTCFunctions.setRemoteDescription, err);
        }
      }
    }
  };
  try {
    that.phone.call(destinationUri, opts);
    Plivo.log.debug('Outgoing call options : ',JSON.stringify(opts.mediaConstraints));
  } catch (err) {
    Plivo.log.error('Failed to execute plivo.onCalling event handler',err);
    Plivo.AppError({"name":err.name,"message":err.message,"method":"call()"});
    return false;
  }
  return true;
};

var dateMs = function(){
  var date = new Date();
  var msdate = (date).toISOString().substring(0, 10)+" "+date.toString().split(" ")[4]+"."+date.getMilliseconds();
  return msdate;
}

var applyStatsSettings = function(that){
  var storage = that.storage
  storage.local_audio = [];
  storage.remote_audio = [];
  storage.mosLocalMeasures = [];
  storage.mosRemoteMeasures = [];
  storage.jitterLocalMeasures = [];
  storage.jitterRemoteMeasures = [];
  storage.packetLossRemoteMeasures = [];
  storage.packetLossLocalMeasures = [];
  storage.rtt = [];
  storage.audioCodec = null;
  // maintain all active and inactive waring status here
  storage.warning = { 
    audioLocalMeasures : false,
    audioRemoteMeasures : false,
    mosLocalMeasures : false,
    mosRemoteMeasures : false,
    jitterLocalMeasures : false,
    jitterRemoteMeasures : false,
    packetLossRemoteMeasures : false,
    packetLossLocalMeasures : false,
    rtt : false,
    ice_connection : false
  }
  storage.startAnalysis = false; // dont start mos immediately after call answer , wait for 5 secs  
  setTimeout(function(){
    storage.startAnalysis = true;
    Plivo.log.debug('Stats startAnalysis started');
  },5000);
  return true;
}
var callStart = function(that){
  that.storage = {};
  return applyStatsSettings(that);
}
var callStatsTokenCb = function(that){
  var forcenew = true;
  return function (forcenew,callback){
    Plivo.log.info('Stats token req...');
    var options = {
      'eventHandlers': {
        'succeeded': function(e){
          Plivo.log.info('Stats token success!');
          var getToken = JSON.parse(e.response.getHeader('x-token'));
          if(getToken && getToken !== "0"){
            return callback(null,getToken.token);
          }else{
            Plivo.log.error('Stats token failed with 0');
            return callback('token failed 0');
          }
        },
        'failed': function(e){
          if(e.response && e.response.status_code){
            Plivo.log.error('Stats token failed!',e.response.status_code);
            return callback(e.response.status_code);
          }else{
            Plivo.log.error('Stats token failed!');
            return callback('failed');            
          }
        }
      },
      'extraHeaders':['X-appID: '+that.options.appId,'X-userID: '+that.userName]
    }
    that.phone.sendMessage('admin', '-- Plivo web client --', options);          
  }
}

var iceConnectionCheck = function(iceState){
  // If iceState goes to disconnected or failed trigger media metrics event
  if( ["disconnected","failed"].indexOf(iceState) != -1){
    _emitter(this,'network','warning','ice_connection', iceState, true, "network drop");
    if(this.storage){
      this.storage.warning.ice_connection=true;
    }
  }
  if(iceState == "connected" && this.storage && this.storage.warning.ice_connection === true){
   _emitter(this,'network','warning','ice_connection', iceState, false); 
   this.storage.warning.ice_connection=false;
  }
}

var detectOWA  = function(cb){
  var localStream,pc1,pc2,servers=null;
  pc1 = new RTCPeerConnection(servers);
  pc2 = new RTCPeerConnection(servers);
  navigator.mediaDevices.getUserMedia({audio:true,video:false}).then(function(stream){
    localStream = stream;
    localOffer(pc1);
  }).catch(errHandler);
  pc1.onicecandidate = function (e){
    onIceCandidate(pc2,e);
  }
  pc2.onicecandidate = function (e){
    onIceCandidate(pc1,e)
  }
  function onIceCandidate(pc, event) {
    if(!event.candidate){ return}
    pc.addIceCandidate(event.candidate)
    .then()
    .catch(errHandler);
  }
  function errHandler(err){
    cb && cb(null,err);
  }

  function localOffer(pc){
    pc.addStream(localStream);
    pc.createOffer().then(function(des){
      pc.setLocalDescription(des).then(function(){
        remoteOffer(pc2,des);
      }).catch(errHandler);
    }).catch(errHandler);
  }
  function remoteOffer(pc, sdp){
    pc.setRemoteDescription(sdp).then(function() {
        if(sdp.type == "offer"){
              pc.createAnswer().then(function(description){
              pc.setLocalDescription(description).then(function() {
              }).catch(errHandler);
              remoteOffer(pc1,description);               
              }).catch(errHandler);       
        }
    }).catch(errHandler);
  }
  function stopStream(){
    if(localStream){
      localStream.getTracks().forEach(function(track) {
        track.stop();
        localStream.removeTrack(track);
        localStream=null;
      });
    }
    pc1.signalingState == "stable" && pc1.close();
    pc2.signalingState == "stable" && pc2.close();
  }
  function getStats(){
    Plivo.log.debug('getUM precheck icestate : '+ pc1.iceConnectionState);
    var statsCounter=0;
    function processGetStats(){
      if(pc1.getLocalStreams()[0]){
        pc1.getStats(function (res) {
              res.result().forEach(function(result) {
              var report = result;
              if (report.type === 'ssrc' && report.stat('mediaType') === 'audio') {
                var cbr = {"bytesSent": report.stat('bytesSent'), "audioInputLevel":report.stat('audioInputLevel')};
                if(Number(cbr.audioInputLevel) <= 0 && statsCounter != 2){
                  statsCounter++;
                  setTimeout(processGetStats,1000);
                  Plivo.log.debug('getUM precheck re-attempt: '+statsCounter);
                }else{
                  cb && cb(cbr,null);
                  setTimeout(stopStream,3000); // since siplib new getUM at next moment is throwing user denied media
                }
              }
              });
        },
          pc1.getLocalStreams()[0].getAudioTracks()[0], 
          errHandler
        );
      }
    }
    processGetStats();
  }
  // Don't wait more than 500ms
  setTimeout(getStats,500);
}

var calcConnStage = function(obj){
  var alinObj = [];
  var connStart;
  for(var i=0; obj.length > i; i++){
    var row = obj[i].split('@');
    if(i == 0){
      connStart = row[1];
      alinObj.push(row[0] +' = '+ row[1]+"#");
    }else{
      var ms = ( new Date(row[1]) - new Date(connStart) );
      if(ms > 1000){
        ms = ms/1000;
        ms = String(ms) + "s#";
      }else{
        ms = String(ms) + "ms#";
      }
      alinObj.push(row[0] +' = '+ row[1] +' +'+ms );
    }
  }
  alinObj = JSON.stringify(alinObj);
  alinObj = alinObj.replace(/[[",\]]/g,'');
  alinObj = alinObj.replace(/#/g,'\n');
  return alinObj;
}

var isSessionConfirmed = function(session){
  if(session){
    return session.is_confirmed
  }else{
    Plivo.log.debug("session not available");
    return false
  }
}

var hangupClearance = function(that){
  // Audio element clearence 
  that.remoteView.pause();
  Plivo.AppError(calcConnStage(that.connStage),'log');
  that.callSession = null;
  delete that.storage;
  that.lastCallUUID = that.callUUID; // save the last call uuid for sending quality feedback
  that.callUUID = null;
  that.callDirection = null;
  if ( window.localStream){
    if(SipLib.adapter.browserDetails.browser == 'chrome' || that.permOnClick){ // stop local streams only for chrome
      try{
        window.localStream.getTracks().forEach(function(track){
                                                  track.stop();
                                                  window.localStream.removeTrack(track);
                                                });
        window.localStream = null;
      }catch(err){
        Plivo.log.debug('error on stop track in localStream : '+err.message);
      }
    }
  }
}

module.exports = Client;
},{"../sipLib/JsSIP":41,"./media/audioDevice":3,"./media/document":4,"./util/callAnalytics":5,"./util/codecPreference":6,"./util/constants":7,"./util/headers":8,"./util/logger":9,"./util/validateOptions":10,"events":13,"util":23}],3:[function(require,module,exports){
var constants = require('../util/constants');

var availableDevices = function(filterBy){
  return new Promise( function(resolve,reject){
    navigator.mediaDevices.enumerateDevices()
    // Array list of all devices
    .then(function(e){
      //Array desc of a single device
      var list =[];
      e.filter(function(dev){
        if(filterBy == "input"){
          if(dev.kind == "audioinput"){
            list.push(dev);
          }
        }else if(filterBy == "output"){
          if(dev.kind == "audiooutput"){
            list.push(dev);
          }
        }else{
          // push all audio input and output devices
          if( !(/video/i).test(dev.kind) ){
            list.push(dev);
          }
        }
      });
      resolve(list);
    })
    .catch(function (error){
      reject(error);
    })
  });
}

var revealAudioDevices = function(arg){
  return new Promise(function(resolve,reject){
    if(navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({audio:true,video:false})
        .then(function(stream) {
          if(arg == "returnStream"){
            resolve(stream);
          }else{
            stream.getTracks().forEach(function(track) {
              track.stop();
            });
            resolve("success");         
          }
        })
        .catch(function(err) {
          Plivo.log.error('failed to get user media :: '+err.name);
          reject(err.name); 
      });
    }else{ reject("no getUserMedia support"); }
  }); 
}

var inputDevices = (function(){
  return {
    set: function(deviceId){
      if(typeof deviceId == "string" && 'optional' in Plivo.audioConstraints){
        Plivo.audioConstraints.optional.push({"sourceId":deviceId});
        return true;
      }
    },
    get: function(){
      if(Plivo.audioConstraints.optional){
        var sourceId = Plivo.audioConstraints.optional.filter(function(e){
          return e["sourceId"];
        });
        if(sourceId.length > 0){
          return sourceId[0]["sourceId"];
        }else{
          return "";
        }
      }else{
        return "";
      }
    },
    reset: function(){
      if(Plivo.audioConstraints.optional){
        Plivo.audioConstraints.optional = Plivo.audioConstraints.optional.filter(function(e){
          return !e["sourceId"];
        });
      }
      return true;
    }
  }
})();

var outputDevices = (function(){
  return {
    set : function(deviceId){
      var speakerElement = document.querySelectorAll('[data-devicetype="speakerDevice"]');
      speakerElement.forEach(function(e){
        e.setSinkId && e.setSinkId(deviceId);
      });
      return true;
    },
    get: function(){
      var speakerElement = document.querySelector('[data-devicetype="speakerDevice"]');
      if(speakerElement.sinkId)
        return speakerElement.sinkId;
    },
    reset: function(){
      var speakerElement = document.querySelectorAll('[data-devicetype="speakerDevice"]');
      speakerElement.forEach(function(e){
        e.setSinkId && e.setSinkId("");
      });
      return true;
    },
    media: function(source){
      var sourceMap = {
        dtmf : "dtmfstar",
        ringback: constants.RINGBACK_ELEMENT_ID    
      }
      if(source && source in sourceMap){
        return document.getElementById(sourceMap[source]);
      }else{
        return document.getElementById(constants.RINGBACK_ELEMENT_ID);
      }
    }
  }
})();

var ringtoneDevices = (function(){
  return {
    set : function(deviceId){
      var ringToneElement = document.getElementById(constants.RINGTONE_ELEMENT_ID);
      ringToneElement.setSinkId && ringToneElement.setSinkId(deviceId);
      return true;
    },
    get: function(){
      var ringToneElement = document.getElementById(constants.RINGTONE_ELEMENT_ID);
      if(ringToneElement.sinkId)
        return ringToneElement.sinkId;   
    },
    reset: function(){
      var ringToneElement = document.getElementById(constants.RINGTONE_ELEMENT_ID);
      ringToneElement.setSinkId && ringToneElement.setSinkId("");
      return true;
    },
    media: function(){
      return document.getElementById(constants.RINGTONE_ELEMENT_ID);
    }
  }
})();

/*
  @param store true/false - true to store in Client for reference 
*/
var audioDevDictionary = function(store){
  var that = this;
  return new Promise( function(resolve,reject){
    availableDevices().then(function(e){
      var audioRef = [];
      e.forEach(function(dev){
        // If device label is not set then audioRef should be null
        if(dev.label){ 
          var strObj = JSON.stringify(dev);
          audioRef.push(strObj);
        }else{
          audioRef = null;
        }
      });
      if(store){
        that.audioDevDic = audioRef;
        resolve(true);
      }else{
        resolve(audioRef); // If you don't want to store then receive as cb
      }
    }).catch(function(err){
      Plivo.log.error('Error availableDevices() ',err);
      reject(err);
    });
  });
}

var checkAudioDevChange = function(){
  var that = this;
  var deviceAdded, deviceRemoved;
  audioDevDictionary().then(function(audioRef){
    if(that.audioDevDic && audioRef){
      //Check if device is newly added with new device change audioRef
      audioRef.forEach(function(e){
        if(that.audioDevDic.indexOf(e) == -1){ // If not present
          deviceAdded = JSON.parse(e);
          /*
            Setting USB audio device as default in mac sound settings will create below 
            1. fire new default device obj for USB audio
            2. fire new device obj with proper lable name for USB audio
            So ignore any new default device object, since we reference point '2'
          */
          if(!/default/i.test(deviceAdded.deviceId)){ 
            that.emit('audioDeviceChange',{change:"added",device:deviceAdded});
          }
        }
      });
      //Check if device is removed with exising audioDic
      that.audioDevDic.forEach(function(e){
        if(audioRef.indexOf(e) == -1){ // If not present
          deviceRemoved = JSON.parse(e);
          /*
            Ignore any default device object which is removed
          */
          if(!/default/i.test(deviceRemoved.deviceId)){
            that.emit('audioDeviceChange',{change:"removed",device:deviceRemoved});
          }
        }        
      });
    }
    if(!that.audioDevDic){
      that.emit('audioDeviceChange',{change:"",device:""});
    }
    if(audioRef){ //Update existing audioDevDic
      that.audioDevDic = audioRef;
    }
  }).catch(function(err){
    Plivo.log.error('Error checkAudioDevChange() ',err);
  });
}

module.exports.inputDevices = inputDevices;
module.exports.outputDevices = outputDevices;
module.exports.ringtoneDevices = ringtoneDevices;
module.exports.revealAudioDevices = revealAudioDevices;
module.exports.availableDevices = availableDevices;
module.exports.audioDevDictionary = audioDevDictionary;
module.exports.checkAudioDevChange = checkAudioDevChange;
},{"../util/constants":7}],4:[function(require,module,exports){
'use strict';
var constants = require('../util/constants');

var setup = function(options, cb) {
  var remoteView = document.createElement('audio');
  remoteView.id = constants.REMOTE_VIEW_ID;
  remoteView.hidden = true;
  remoteView.autoplay = true;
  remoteView.width = 0;
  remoteView.height = 0;
  remoteView.setAttribute('data-devicetype','speakerDevice');
  document.body.appendChild(remoteView);

  var audioConnectingElement = document.createElement('audio');
  audioConnectingElement.id = constants.CONNECT_TONE_ELEMENT_ID;
  audioConnectingElement.loop = 'loop';
  audioConnectingElement.src = constants.CONNECT_TONE_URL;
  audioConnectingElement.setAttribute('data-devicetype','speakerDevice');
  document.body.appendChild(audioConnectingElement);

  var audioRingBackElement = document.createElement('audio');
  audioRingBackElement.id = constants.RINGBACK_ELEMENT_ID;
  audioRingBackElement.loop = 'loop';
  audioRingBackElement.src = constants.RINGTONE_URL;
  audioRingBackElement.setAttribute('data-devicetype','speakerDevice');
  document.body.appendChild(audioRingBackElement);

  var audioRingToneElement = document.createElement('audio');
  audioRingToneElement.id = constants.RINGTONE_ELEMENT_ID;
  audioRingToneElement.loop = 'loop';
  audioRingToneElement.src = constants.RINGTONE_URL;
  audioRingToneElement.setAttribute('data-devicetype','ringtoneDevice');
  document.body.appendChild(audioRingToneElement);

  var format = 'mp3';
  var baseUrl = 'https://cdn.plivo.com/sdk/browser/audio/dtmf-';

  var addDTMFTone = function (baseUrl, digit, format) {
    var id = 'dtmf' + digit;  
    var src = baseUrl + digit + '.' + format;
    var obj = document.createElement('audio');
    obj.id = id;
    obj.src = src;
    obj.setAttribute('data-devicetype','speakerDevice');
    document.body.appendChild(obj);
  };

  for (var i = 0; i <= 9; i++) {
    addDTMFTone(baseUrl, i, format);
  }

  addDTMFTone(baseUrl, 'star', format);
  addDTMFTone(baseUrl, 'pound', format);

  if(options.permOnClick){
    window.localStream = null;
    cb({status:'success',stream:false});
  }else{
    getLocalMedia(options.audioConstraints,function(evt){
      cb(evt);
    });
  }
};

var getLocalMedia = function(audioConstraints, cb){
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({audio: audioConstraints,video: false})
      .then(function(stream) {
        window.localStream = stream;
        Plivo.log.debug('getUserMedia success');
        cb({'status':'success','stream':true});      
      })
      .catch(function(err) {
        Plivo.log.error('failed to get user media :: '+err.name);
        cb({'status':'failure','error':err.name});    
    });
  }else{
    Plivo.log.error('getUserMedia not available');
    cb({status:'failure','error':'getUserMedia not supported'});
  }
}

var playAudio = function(elementId) {
  try {
    document.getElementById(elementId).play();
    Plivo.log.debug('playAudio - '+elementId);
  } catch (e) { 
    Plivo.log.debug('failed to play audio for elementId ' + elementId + ' Cause: ' + e);
  }
};

var stopAudio = function(elementId) {
  try {
    document.getElementById(elementId).pause();
    Plivo.log.debug('stopAudio - '+elementId);
  } catch (e) {
    Plivo.log.debug('failed to stop audio for elementId ' + elementId + ' Cause: ' + e);
  }
};

var maskPage = function () {
  var tag = document.createElement('div');
  tag.id = "plivo_mask";
  document.body.insertBefore(tag, document.body.firstChild);
  tag.style.position = "fixed";
  tag.style.top = "0";
  tag.style.left = "0";
  tag.style.width = "100%";
  tag.style.height = "100%";
  tag.style.background = "#000";
  tag.style.opacity = "0.8";
  tag.style.filter = "alpha(opacity=80)";
  tag.style.zindex = "50";
};

module.exports.setup = setup;
module.exports.getLocalMedia = getLocalMedia;
module.exports.playAudio = playAudio;
module.exports.stopAudio = stopAudio;
module.exports.maskPage = maskPage;
},{"../util/constants":7}],5:[function(require,module,exports){
var processSteams = function(_emitter, streams){
  var that = this;
  function processAudioLevel(type,val){
    var audioObj = that.storage[type];
    if(audioObj.length == 2){ // Check at every 3 collection
      audioObj.push(Number(val));

      // unchanged volume level is processed here; 
      var identicalCollector = {};
      var audioVol = null; // most identical audio volume gets updated here
      audioObj.forEach(function(val){
          identicalCollector[val] = identicalCollector[val] + 1 || 1;
      });
      for(var vol in identicalCollector){
        if(identicalCollector[vol] >=2){ // if 2 or more vol is same out of 3 sample
          audioVol = Number(vol);
        }
      }
      if(typeof audioVol == "number"){ //identical volumes like 0, 8 are considered to mute  
        that.storage.warning[type] = true;
        if(audioVol > 1){
          Plivo.log.debug('Same audioLevel detected for '+type+" : ",that.str(audioObj));
        }else{
          Plivo.log.debug('Audio mute detected for '+type+" : ",that.str(audioObj));
        }
        _emitter(that,'audio','warning','no_audio_received', audioVol, true, type);
      }else{
        that.storage.warning[type] ? (that.storage.warning[type]=false, _emitter(that,'audio','warning','no_audio_received', 0, false, type)) : null;
      }
    }else{
      audioObj.push(Number(val));
    }
    if(audioObj.length == 3)
      audioObj.splice(0,2) // remove first 2, after every 3 samples
  }
  function processRtt(type, val){
    var val = Number(val);
    var rttObj = that.storage[type];
    if(rttObj.length == 2){
      rttObj.push(val);
      // console.debug('processRtt',rttObj);
      var totRttObj = rttObj.filter(function (item, pos){
        return item > 400;
      });
      if(totRttObj.length >= 2){
        var rttSum = totRttObj.reduce(function(sum, val){
          return sum + val;
        });
        var rttAvg = (rttSum / totRttObj.length ).toFixed(2);
        that.storage.warning[type] = true;
        Plivo.log.debug(type+" : getting high rtt  : ",that.str(totRttObj));
        _emitter(that,'network','warning','high_rtt', rttAvg, true, 'high latency');
      }else{
        that.storage.warning[type] ? (that.storage.warning[type]=false, _emitter(that,'network','warning','high_rtt', 0, false)) : null;
      }     
    }else{
      rttObj.push(val);
    }
    if(rttObj.length == 3)
      rttObj.splice(0,2) // remove first 2, after every 3 samples     
  }
  function processJitter(type,val){
    var val = Number(val);
    var jitterObj = that.storage[type];
    if(jitterObj.length == 2){
      jitterObj.push(val);
      // console.debug('processJitter',jitterObj);
      var totJitterObj = jitterObj.filter(function (item, pos){
        return item > 30;
      });
      if(totJitterObj.length >= 2){
        var jitterSum = totJitterObj.reduce(function(sum, val){
          return sum + val;
        });
        var jitterAvg = jitterSum / totJitterObj.length;
        that.storage.warning[type] = true;
        Plivo.log.debug(type+" : getting high jitter rate : ",that.str(totJitterObj));
        _emitter(that,'network','warning','high_jitter', jitterAvg, true, type);
      }else{
        that.storage.warning[type] ? (that.storage.warning[type]=false, _emitter(that,'network','warning','high_jitter', 0, false, type)) : null;
      }
    }else{
      jitterObj.push(val);
    }
    if(jitterObj.length == 3)
      jitterObj.splice(0,2) // remove first 2, after every 3 samples          
  }
  function processMos(type,val){
    // Ignore first 3 MOS score of a new call, since first 2-3 mos comes as fair
    var mosObj = that.storage[type];
    if(mosObj.length == 2){
      mosObj.push(val);
      // console.debug('processMos',mosObj);
      var totMosObj = mosObj.filter(function (item, pos){
        if(that.storage.audioCodec == "opus"){ // for opus alone look for "bad" mos
          return item == 'bad';
        }else{
          return item != 'excellent';
        }
      });
      if(totMosObj.length >= 2){
        that.storage.warning[type] = true;
        Plivo.log.debug(type+" : getting low mos : ",that.str(mosObj));
        _emitter(that,'network','warning','low_mos', totMosObj[0], true, type);
      }else{
        that.storage.warning[type] ? (that.storage.warning[type]=false, _emitter(that,'network','warning','low_mos', 0, false, type)) : null;
      }
    }else{
      mosObj.push(val);
    }
    if(mosObj.length == 3)
      mosObj.splice(0,2) // remove first 2, after every 3 samples
  }
  function processPacketLoss(type, val){
    var val = Number(val);
    var plossObj = that.storage[type];
    if(plossObj.length == 2){ // Check at every 3 collection
      plossObj.push(val);
      // console.debug('processPacketLoss',plossObj);
      var totPlossObj = plossObj.filter(function (item, pos){
        if(that.storage.audioCodec == "opus"){
          return item >= 0.10; // greater than 10%
        }else{
          return item >= 0.02; // greater than 2%
        }
      });
      if(totPlossObj.length >= 2){
        var plossSum = totPlossObj.reduce(function (sum, val){
          return sum + val;
        });
        var plossAvg = plossSum / totPlossObj.length;
        plossAvg = plossAvg.toFixed(3);
        that.storage.warning[type] = true;
        Plivo.log.debug(type+' : ploss score value is high :',that.str(totPlossObj));
        _emitter(that,'network','warning','high_packetloss', plossAvg, true, type);
      }else{
        that.storage.warning[type] ? (that.storage.warning[type]=false,_emitter(that,'network','warning','high_packetloss', 0, false, type)): null;
      }
    }else{
      plossObj.push(val);
    }
    if(plossObj.length == 3)
      plossObj.splice(0,2) // remove first 2, after every 3 samples
  }

  // actual handler
  if(!that.storage || !that.storage.startAnalysis){  // start only if startAnalysis becomes true
    return;
  }

  for( var key in streams){
    //local
    if("audioInputLevel" in streams[key]){
      var obj = streams[key],
          fractionLoss = obj.fractionLoss? obj.fractionLoss.toFixed(2) : 0,
          bitrate      = obj.bitrate ? obj.bitrate.toFixed(2) : 0,
          quality      = obj.quality || null,
          rtt          = obj.rtt || 0,
          jitter       = obj.jitter || 0,
          audioInputLevel=obj.audioInputLevel || 0;
      processAudioLevel("local_audio", audioInputLevel);
      processRtt("rtt",rtt);
      processJitter('jitterLocalMeasures',jitter);
      // processMos('local',quality);
      processPacketLoss('packetLossLocalMeasures',fractionLoss);
    // remote  
    }else if("audioOutputLevel" in streams[key]){ 
      var obj = streams[key],
          fractionLoss = obj.fractionLoss? obj.fractionLoss.toFixed(2) : 0,
          bitrate      = obj.bitrate ? obj.bitrate.toFixed(2) : 0,
          quality      = obj.quality || null,
          jitter       = obj.jitter || 0,
          audioOutputLevel=obj.audioOutputLevel || 0;               
      processAudioLevel("remote_audio", audioOutputLevel);
      processJitter('jitterRemoteMeasures',jitter);
      processMos('mosRemoteMeasures',quality);
      processPacketLoss('packetLossRemoteMeasures',fractionLoss);
    }
  }
}  

module.exports = processSteams;
},{}],6:[function(require,module,exports){
var codecPref = function(prefCodecs, sdp){

  function getPayloadValue(codec, sdp){
    var reg = new RegExp( 'a=rtpmap:.* '+codec+'(.*)', 'ig');
    if(sdp.match(reg)){
      return sdp.match(reg)[0].split(' ')[0].match(/\d+/);
    }else{
      return false;
    }
  }

  function clearCodec(payloadVal, sdp){
    var reg;
    payloadVal.forEach(function(codec){
      var val = getPayloadValue(codec,sdp);
      // clear in rtpmap
      reg = new RegExp ('\na=rtpmap:.*'+codec+'\/.*','ig');
      sdp = sdp.replace(reg,'');
      // clear in fmtp
      reg = new RegExp ('\na=fmtp:'+val+' (.*)','ig');
      sdp = sdp.replace(reg,'');
      // clear in rtcp
      reg = new RegExp ('\na=rtcp-fb:'+val+' (.*)','ig');
      sdp = sdp.replace(reg,'');
    });
    return sdp;
  }
  
  if(prefCodecs.length > 0){
    var totalList = ['OPUS','G722','PCMA','PCMU','ISAC','CN'];
    var codecListName = prefCodecs;
    var codecListVal = "";
    codecListName.forEach(function(codec){
      var index = totalList.indexOf(codec);
      if(index > -1){
        totalList.splice(index, 1);
      }
      var codecPayloadVal = getPayloadValue(codec,sdp);
      if(codecPayloadVal)
        codecListVal += codecPayloadVal + " ";
    });
    codecListVal = codecListVal.slice(0,-1);
    sdp = sdp.replace(sdp.match(/m=audio .*[a-z] (.*)/i)[1],codecListVal);
    sdp = clearCodec(totalList,sdp);
  }
  return sdp;
}

module.exports = codecPref
},{}],7:[function(require,module,exports){
'use strict';

//webrtc settings
module.exports.DEFAULT_LOG_LEVEL = 'INFO';
module.exports.DOMAIN = 'phone.plivo.com'; 
module.exports.WS_SERVERS = 'wss://phone.plivo.com:5063';
module.exports.REGISTER_EXPIRES_SECONDS = 120;
module.exports.SESSION_TIMERS_EXPIRES = 300;
module.exports.WS_RECOVERY_MAX_INTERVAL = 20;
module.exports.WS_RECOVERY_MIN_INTERVAL = 2;
module.exports.DEFAULT_CODECS = ['OPUS','PCMU'];
module.exports.STUN_SERVERS = ['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302'];
module.exports.LIB_NAME = 'plivojs';
module.exports.DEBUG_MODES = ['INFO','DEBUG','WARN','ERROR','ALL','ALL-PLAIN','OFF'];
module.exports.REGION = ["usa_west","usa_east","australia","europe","asia","south_america"];
//document settings
module.exports.RINGTONE_URL = 'https://cdn.plivo.com/sdk/browser/audio/us-ring.mp3';
module.exports.CONNECT_TONE_URL = 'https://cdn.plivo.com/sdk/browser/audio/connect-tone.mp3';
module.exports.SELF_VIEW_ID = 'plivo_webrtc_selfview';
module.exports.REMOTE_VIEW_ID = 'plivo_webrtc_remoteview'; // depreciate it. Since remote view is needed only for Video 
module.exports.RINGBACK_ELEMENT_ID = 'plivo_ringbacktone';
module.exports.RINGTONE_ELEMENT_ID = 'plivo_ringtone';
module.exports.CONNECT_TONE_ELEMENT_ID = 'plivo_connect_tone';
module.exports.DTMF_TONE_FLAG = {
  '0': true,
  '1': true,
  '2': true,
  '3': true,
  '4': true,
  '5': true,
  '6': true,
  '7': true,
  '8': true,
  '9': true,
  '#': true,
  '*': true
};

module.exports.DEFAULT_COMMENTS = ['bad-audio', 'call-dropped', 'wrong-callerid', 'post-dial-delay', 'dtmf-not-captured', 'audio-latency', 'unsolicited-call', 'one-way-audio', 'no-audio', 'never-connected']

var DEFAULT_OFFER_OPTIONS = {};
if (typeof navigator !== 'undefined' && navigator.mozGetUserMedia) {
  DEFAULT_OFFER_OPTIONS = {
    offerToReceiveAudio: true
  };
} else {
  DEFAULT_OFFER_OPTIONS.mandatory = {
    OfferToReceiveAudio: true
  };
}
module.exports.DEFAULT_OFFER_OPTIONS = DEFAULT_OFFER_OPTIONS;

},{}],8:[function(require,module,exports){
'use strict';

var checkExtraHeaderKey = function (key) {
  //key started by X-Ph-
  if (key.substr(0, 5) != "X-Ph-" && key.substr(0, 5) != "X-PH-") {
    return false;
  }

  //key only contain [A-Z], [a-z] and [0-9], max length = 24
  //19 = 24 - 5
  var keyRegex = /^([a-z0-9A-Z]){1,19}$/;
  return keyRegex.test(key.substr(5)) !== false;
};

var checkExtraHeaderVal = function (value) {
  //value only contain [A-Z], [a-z], [0-9] and '%', max length = 48
  var valRegex = /^([a-z0-9A-Z_\-\+\(\)%]){1,120}$/; //+-_() added to Customer headers on 13th April as per callstats.io request
  return valRegex.test(value) !== false;
};

var receiveExtraHeader = function(request, headers) {
  var cleanExtraHeaders = {};
  for (var key in headers) {
    var val = request.getHeader(key);
    if (checkExtraHeaderKey(key) && checkExtraHeaderVal(val)) {
      cleanExtraHeaders[key] = val;
    }
  }

  return cleanExtraHeaders;
};

module.exports.checkExtraHeaderKey = checkExtraHeaderKey;
module.exports.checkExtraHeaderVal = checkExtraHeaderVal;
module.exports.receiveExtraHeader = receiveExtraHeader;

},{}],9:[function(require,module,exports){
var logger = function (options) {
	options? options : (options = {});
	var allowedMethods = ['INFO','DEBUG','WARN','ERROR','ALL','OFF']
		,logMethod = options.logMethod || "INFO"
		,enableDate = options.enableDate || false
		,loggingName = options.loggingName || "";
	var localStorage = (typeof chrome != 'undefined' && chrome.storage) ? chrome.storage.local : window.localStorage;		
	var logit = function(){
		function logging(){
			if(enableDate){
				var date = new Date();
				var msdate = (date).toISOString().substring(0, 10)+" "+date.toString().split(" ")[4]+"."+date.getMilliseconds();
				console.log("["+msdate+"]" + " ["+filter+"] "+loggingName+" :: ",arg1,arg2);
			}else{
				console.log("["+filter+"] "+loggingName+" :: ",arg1,arg2);
			}
		}
		var filter = arguments[0].toUpperCase() // will give info/debug/warn/error etc
			,args = arguments[1]
			,arg1 = args[0] || ""
			,arg2 = args[1] || "";
		if(logMethod == "DEBUG" || logMethod == "ALL"){
			logging();
		}else if(logMethod == filter){
			logging();
		}else{
			return;
		}
	}
	return {
		info: function(){
			logit('info',arguments);
		},
		debug: function(){
			logit('debug',arguments);
		},
		warn: function(){
			logit('warn',arguments);
		},
		error: function(){
			logit('error',arguments);
		},
		setLevel: function(method){
			method = method.toUpperCase();
			if(allowedMethods.indexOf(method) != -1){ // in allowed methods?
				logMethod = method;
				if(['DEBUG','ALL'].indexOf(method) == -1){ // if not debug/all!
					localStorage.debug="";
				}
				return 'logLevel is now : '+logMethod;
			}else{ 
				return 'only : '+allowedMethods.toString() + ' are allowed in run time!'
			}
		},
		level: function(){
			return logMethod;
		}
	}
}
module.exports = logger;
},{}],10:[function(require,module,exports){
var codecs = function (codecs, defaultCodecs){
	if(Object.prototype.toString.call(codecs) == "[object Array]"){
	  var isCheckPassed=true;
	  codecs.forEach(function(codec){
	    if(defaultCodecs.indexOf(codec) == -1){
	      isCheckPassed = false;
	      Plivo.log.warn('Ignoring invalid codec - ',codec);
	      Plivo.log.debug('Allowed list: ',defaultCodecs);
	    }
	  });
	  if(isCheckPassed){
	    return true;
	  }else{
	  	return false;
	  }
	}else{ 
	  Plivo.log.error('Please send codecs in Array. Eg:',defaultCodecs);
	  return false;
	}
}

var isBoolean = function (key, val){
	if(typeof val == "boolean"){
		return true;
	}else{
		Plivo.log.error(key +' has to be boolean. '+ val + ' is not accepted')
		return false;
	}
}

var debug = function (mode, defaultModes) {
	if(defaultModes.indexOf(mode) == -1){
		Plivo.log.error('debug method '+mode+' is not allowed');
		Plivo.log.debug('Allowed list for debug: ',defaultModes);
		return false;
	}else{
		return true;
	}
}

var region = function (name, defaultRegions){
	if(defaultRegions.indexOf(name) == -1){
		Plivo.log.error('region name '+ name + ' is not allowed');
		Plivo.log.debug('Allowed list for regions: ',defaultRegions);
		return false;
	}else{
		return true;
	}
}

module.exports = {
	codecs: codecs,
	isBoolean : isBoolean,
	debug: debug,
	region: region
}
},{}],11:[function(require,module,exports){
(function (process){
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = window._PlivoUseColorLog;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}

}).call(this,require('_process'))
},{"./debug":12,"_process":15}],12:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":14}],13:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],14:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],15:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],16:[function(require,module,exports){
var grammar = module.exports = {
  v: [{
    name: 'version',
    reg: /^(\d*)$/
  }],
  o: [{ //o=- 20518 0 IN IP4 203.0.113.1
    // NB: sessionId will be a String in most cases because it is huge
    name: 'origin',
    reg: /^(\S*) (\d*) (\d*) (\S*) IP(\d) (\S*)/,
    names: ['username', 'sessionId', 'sessionVersion', 'netType', 'ipVer', 'address'],
    format: '%s %s %d %s IP%d %s'
  }],
  // default parsing of these only (though some of these feel outdated)
  s: [{ name: 'name' }],
  i: [{ name: 'description' }],
  u: [{ name: 'uri' }],
  e: [{ name: 'email' }],
  p: [{ name: 'phone' }],
  z: [{ name: 'timezones' }], // TODO: this one can actually be parsed properly..
  r: [{ name: 'repeats' }],   // TODO: this one can also be parsed properly
  //k: [{}], // outdated thing ignored
  t: [{ //t=0 0
    name: 'timing',
    reg: /^(\d*) (\d*)/,
    names: ['start', 'stop'],
    format: '%d %d'
  }],
  c: [{ //c=IN IP4 10.47.197.26
    name: 'connection',
    reg: /^IN IP(\d) (\S*)/,
    names: ['version', 'ip'],
    format: 'IN IP%d %s'
  }],
  b: [{ //b=AS:4000
    push: 'bandwidth',
    reg: /^(TIAS|AS|CT|RR|RS):(\d*)/,
    names: ['type', 'limit'],
    format: '%s:%s'
  }],
  m: [{ //m=video 51744 RTP/AVP 126 97 98 34 31
    // NB: special - pushes to session
    // TODO: rtp/fmtp should be filtered by the payloads found here?
    reg: /^(\w*) (\d*) ([\w\/]*)(?: (.*))?/,
    names: ['type', 'port', 'protocol', 'payloads'],
    format: '%s %d %s %s'
  }],
  a: [
    { //a=rtpmap:110 opus/48000/2
      push: 'rtp',
      reg: /^rtpmap:(\d*) ([\w\-\.]*)(?:\s*\/(\d*)(?:\s*\/(\S*))?)?/,
      names: ['payload', 'codec', 'rate', 'encoding'],
      format: function (o) {
        return (o.encoding) ?
          'rtpmap:%d %s/%s/%s':
          o.rate ?
          'rtpmap:%d %s/%s':
          'rtpmap:%d %s';
      }
    },
    { //a=fmtp:108 profile-level-id=24;object=23;bitrate=64000
      //a=fmtp:111 minptime=10; useinbandfec=1
      push: 'fmtp',
      reg: /^fmtp:(\d*) ([\S| ]*)/,
      names: ['payload', 'config'],
      format: 'fmtp:%d %s'
    },
    { //a=control:streamid=0
      name: 'control',
      reg: /^control:(.*)/,
      format: 'control:%s'
    },
    { //a=rtcp:65179 IN IP4 193.84.77.194
      name: 'rtcp',
      reg: /^rtcp:(\d*)(?: (\S*) IP(\d) (\S*))?/,
      names: ['port', 'netType', 'ipVer', 'address'],
      format: function (o) {
        return (o.address != null) ?
          'rtcp:%d %s IP%d %s':
          'rtcp:%d';
      }
    },
    { //a=rtcp-fb:98 trr-int 100
      push: 'rtcpFbTrrInt',
      reg: /^rtcp-fb:(\*|\d*) trr-int (\d*)/,
      names: ['payload', 'value'],
      format: 'rtcp-fb:%d trr-int %d'
    },
    { //a=rtcp-fb:98 nack rpsi
      push: 'rtcpFb',
      reg: /^rtcp-fb:(\*|\d*) ([\w-_]*)(?: ([\w-_]*))?/,
      names: ['payload', 'type', 'subtype'],
      format: function (o) {
        return (o.subtype != null) ?
          'rtcp-fb:%s %s %s':
          'rtcp-fb:%s %s';
      }
    },
    { //a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
      //a=extmap:1/recvonly URI-gps-string
      push: 'ext',
      reg: /^extmap:(\d+)(?:\/(\w+))? (\S*)(?: (\S*))?/,
      names: ['value', 'direction', 'uri', 'config'],
      format: function (o) {
        return 'extmap:%d' + (o.direction ? '/%s' : '%v') + ' %s' + (o.config ? ' %s' : '');
      }
    },
    { //a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:PS1uQCVeeCFCanVmcjkpPywjNWhcYD0mXXtxaVBR|2^20|1:32
      push: 'crypto',
      reg: /^crypto:(\d*) ([\w_]*) (\S*)(?: (\S*))?/,
      names: ['id', 'suite', 'config', 'sessionConfig'],
      format: function (o) {
        return (o.sessionConfig != null) ?
          'crypto:%d %s %s %s':
          'crypto:%d %s %s';
      }
    },
    { //a=setup:actpass
      name: 'setup',
      reg: /^setup:(\w*)/,
      format: 'setup:%s'
    },
    { //a=mid:1
      name: 'mid',
      reg: /^mid:([^\s]*)/,
      format: 'mid:%s'
    },
    { //a=msid:0c8b064d-d807-43b4-b434-f92a889d8587 98178685-d409-46e0-8e16-7ef0db0db64a
      name: 'msid',
      reg: /^msid:(.*)/,
      format: 'msid:%s'
    },
    { //a=ptime:20
      name: 'ptime',
      reg: /^ptime:(\d*)/,
      format: 'ptime:%d'
    },
    { //a=maxptime:60
      name: 'maxptime',
      reg: /^maxptime:(\d*)/,
      format: 'maxptime:%d'
    },
    { //a=sendrecv
      name: 'direction',
      reg: /^(sendrecv|recvonly|sendonly|inactive)/
    },
    { //a=ice-lite
      name: 'icelite',
      reg: /^(ice-lite)/
    },
    { //a=ice-ufrag:F7gI
      name: 'iceUfrag',
      reg: /^ice-ufrag:(\S*)/,
      format: 'ice-ufrag:%s'
    },
    { //a=ice-pwd:x9cml/YzichV2+XlhiMu8g
      name: 'icePwd',
      reg: /^ice-pwd:(\S*)/,
      format: 'ice-pwd:%s'
    },
    { //a=fingerprint:SHA-1 00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33
      name: 'fingerprint',
      reg: /^fingerprint:(\S*) (\S*)/,
      names: ['type', 'hash'],
      format: 'fingerprint:%s %s'
    },
    { //a=candidate:0 1 UDP 2113667327 203.0.113.1 54400 typ host
      //a=candidate:1162875081 1 udp 2113937151 192.168.34.75 60017 typ host generation 0 network-id 3 network-cost 10
      //a=candidate:3289912957 2 udp 1845501695 193.84.77.194 60017 typ srflx raddr 192.168.34.75 rport 60017 generation 0 network-id 3 network-cost 10
      //a=candidate:229815620 1 tcp 1518280447 192.168.150.19 60017 typ host tcptype active generation 0 network-id 3 network-cost 10
      //a=candidate:3289912957 2 tcp 1845501695 193.84.77.194 60017 typ srflx raddr 192.168.34.75 rport 60017 tcptype passive generation 0 network-id 3 network-cost 10
      push:'candidates',
      reg: /^candidate:(\S*) (\d*) (\S*) (\d*) (\S*) (\d*) typ (\S*)(?: raddr (\S*) rport (\d*))?(?: tcptype (\S*))?(?: generation (\d*))?(?: network-id (\d*))?(?: network-cost (\d*))?/,
      names: ['foundation', 'component', 'transport', 'priority', 'ip', 'port', 'type', 'raddr', 'rport', 'tcptype', 'generation', 'network-id', 'network-cost'],
      format: function (o) {
        var str = 'candidate:%s %d %s %d %s %d typ %s';

        str += (o.raddr != null) ? ' raddr %s rport %d' : '%v%v';

        // NB: candidate has three optional chunks, so %void middles one if it's missing
        str += (o.tcptype != null) ? ' tcptype %s' : '%v';

        if (o.generation != null) {
          str += ' generation %d';
        }

        str += (o['network-id'] != null) ? ' network-id %d' : '%v';
        str += (o['network-cost'] != null) ? ' network-cost %d' : '%v';
        return str;
      }
    },
    { //a=end-of-candidates (keep after the candidates line for readability)
      name: 'endOfCandidates',
      reg: /^(end-of-candidates)/
    },
    { //a=remote-candidates:1 203.0.113.1 54400 2 203.0.113.1 54401 ...
      name: 'remoteCandidates',
      reg: /^remote-candidates:(.*)/,
      format: 'remote-candidates:%s'
    },
    { //a=ice-options:google-ice
      name: 'iceOptions',
      reg: /^ice-options:(\S*)/,
      format: 'ice-options:%s'
    },
    { //a=ssrc:2566107569 cname:t9YU8M1UxTF8Y1A1
      push: 'ssrcs',
      reg: /^ssrc:(\d*) ([\w_]*)(?::(.*))?/,
      names: ['id', 'attribute', 'value'],
      format: function (o) {
        var str = 'ssrc:%d';
        if (o.attribute != null) {
          str += ' %s';
          if (o.value != null) {
            str += ':%s';
          }
        }
        return str;
      }
    },
    { //a=ssrc-group:FEC 1 2
      //a=ssrc-group:FEC-FR 3004364195 1080772241
      push: 'ssrcGroups',
      // token-char = %x21 / %x23-27 / %x2A-2B / %x2D-2E / %x30-39 / %x41-5A / %x5E-7E
      reg: /^ssrc-group:([\x21\x23\x24\x25\x26\x27\x2A\x2B\x2D\x2E\w]*) (.*)/,
      names: ['semantics', 'ssrcs'],
      format: 'ssrc-group:%s %s'
    },
    { //a=msid-semantic: WMS Jvlam5X3SX1OP6pn20zWogvaKJz5Hjf9OnlV
      name: 'msidSemantic',
      reg: /^msid-semantic:\s?(\w*) (\S*)/,
      names: ['semantic', 'token'],
      format: 'msid-semantic: %s %s' // space after ':' is not accidental
    },
    { //a=group:BUNDLE audio video
      push: 'groups',
      reg: /^group:(\w*) (.*)/,
      names: ['type', 'mids'],
      format: 'group:%s %s'
    },
    { //a=rtcp-mux
      name: 'rtcpMux',
      reg: /^(rtcp-mux)/
    },
    { //a=rtcp-rsize
      name: 'rtcpRsize',
      reg: /^(rtcp-rsize)/
    },
    { //a=sctpmap:5000 webrtc-datachannel 1024
      name: 'sctpmap',
      reg: /^sctpmap:([\w_\/]*) (\S*)(?: (\S*))?/,
      names: ['sctpmapNumber', 'app', 'maxMessageSize'],
      format: function (o) {
        return (o.maxMessageSize != null) ?
          'sctpmap:%s %s %s' :
          'sctpmap:%s %s';
      }
    },
    { //a=x-google-flag:conference
      name: 'xGoogleFlag',
      reg: /^x-google-flag:([^\s]*)/,
      format: 'x-google-flag:%s'
    },
    { //a=rid:1 send max-width=1280;max-height=720;max-fps=30;depend=0
      push: 'rids',
      reg: /^rid:([\d\w]+) (\w+)(?: ([\S| ]*))?/,
      names: ['id', 'direction', 'params'],
      format: function (o) {
        return (o.params) ? 'rid:%s %s %s' : 'rid:%s %s';
      }
    },
    { //a=imageattr:97 send [x=800,y=640,sar=1.1,q=0.6] [x=480,y=320] recv [x=330,y=250]
      //a=imageattr:* send [x=800,y=640] recv *
      //a=imageattr:100 recv [x=320,y=240]
      push: 'imageattrs',
      reg: new RegExp(
        //a=imageattr:97
        '^imageattr:(\\d+|\\*)' +
        //send [x=800,y=640,sar=1.1,q=0.6] [x=480,y=320]
        '[\\s\\t]+(send|recv)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*)' +
        //recv [x=330,y=250]
        '(?:[\\s\\t]+(recv|send)[\\s\\t]+(\\*|\\[\\S+\\](?:[\\s\\t]+\\[\\S+\\])*))?'
      ),
      names: ['pt', 'dir1', 'attrs1', 'dir2', 'attrs2'],
      format: function (o) {
        return 'imageattr:%s %s %s' + (o.dir2 ? ' %s %s' : '');
      }
    },
    { //a=simulcast:send 1,2,3;~4,~5 recv 6;~7,~8
      //a=simulcast:recv 1;4,5 send 6;7
      name: 'simulcast',
      reg: new RegExp(
        //a=simulcast:
        '^simulcast:' +
        //send 1,2,3;~4,~5
        '(send|recv) ([a-zA-Z0-9\\-_~;,]+)' +
        //space + recv 6;~7,~8
        '(?:\\s?(send|recv) ([a-zA-Z0-9\\-_~;,]+))?' +
        //end
        '$'
      ),
      names: ['dir1', 'list1', 'dir2', 'list2'],
      format: function (o) {
        return 'simulcast:%s %s' + (o.dir2 ? ' %s %s' : '');
      }
    },
    { //Old simulcast draft 03 (implemented by Firefox)
      //  https://tools.ietf.org/html/draft-ietf-mmusic-sdp-simulcast-03
      //a=simulcast: recv pt=97;98 send pt=97
      //a=simulcast: send rid=5;6;7 paused=6,7
      name: 'simulcast_03',
      reg: /^simulcast:[\s\t]+([\S+\s\t]+)$/,
      names: ['value'],
      format: 'simulcast: %s'
    },
    {
      //a=framerate:25
      //a=framerate:29.97
      name: 'framerate',
      reg: /^framerate:(\d+(?:$|\.\d+))/,
      format: 'framerate:%s'
    },
    { // any a= that we don't understand is kepts verbatim on media.invalid
      push: 'invalid',
      names: ['value']
    }
  ]
};

// set sensible defaults to avoid polluting the grammar with boring details
Object.keys(grammar).forEach(function (key) {
  var objs = grammar[key];
  objs.forEach(function (obj) {
    if (!obj.reg) {
      obj.reg = /(.*)/;
    }
    if (!obj.format) {
      obj.format = '%s';
    }
  });
});

},{}],17:[function(require,module,exports){
var parser = require('./parser');
var writer = require('./writer');

exports.write = writer;
exports.parse = parser.parse;
exports.parseFmtpConfig = parser.parseFmtpConfig;
exports.parseParams = parser.parseParams;
exports.parsePayloads = parser.parsePayloads;
exports.parseRemoteCandidates = parser.parseRemoteCandidates;
exports.parseImageAttributes = parser.parseImageAttributes;
exports.parseSimulcastStreamList = parser.parseSimulcastStreamList;

},{"./parser":18,"./writer":19}],18:[function(require,module,exports){
var toIntIfInt = function (v) {
  return String(Number(v)) === v ? Number(v) : v;
};

var attachProperties = function (match, location, names, rawName) {
  if (rawName && !names) {
    location[rawName] = toIntIfInt(match[1]);
  }
  else {
    for (var i = 0; i < names.length; i += 1) {
      if (match[i+1] != null) {
        location[names[i]] = toIntIfInt(match[i+1]);
      }
    }
  }
};

var parseReg = function (obj, location, content) {
  var needsBlank = obj.name && obj.names;
  if (obj.push && !location[obj.push]) {
    location[obj.push] = [];
  }
  else if (needsBlank && !location[obj.name]) {
    location[obj.name] = {};
  }
  var keyLocation = obj.push ?
    {} :  // blank object that will be pushed
    needsBlank ? location[obj.name] : location; // otherwise, named location or root

  attachProperties(content.match(obj.reg), keyLocation, obj.names, obj.name);

  if (obj.push) {
    location[obj.push].push(keyLocation);
  }
};

var grammar = require('./grammar');
var validLine = RegExp.prototype.test.bind(/^([a-z])=(.*)/);

exports.parse = function (sdp) {
  var session = {}
    , media = []
    , location = session; // points at where properties go under (one of the above)

  // parse lines we understand
  sdp.split(/(\r\n|\r|\n)/).filter(validLine).forEach(function (l) {
    var type = l[0];
    var content = l.slice(2);
    if (type === 'm') {
      media.push({rtp: [], fmtp: []});
      location = media[media.length-1]; // point at latest media line
    }

    for (var j = 0; j < (grammar[type] || []).length; j += 1) {
      var obj = grammar[type][j];
      if (obj.reg.test(content)) {
        return parseReg(obj, location, content);
      }
    }
  });

  session.media = media; // link it up
  return session;
};

var paramReducer = function (acc, expr) {
  var s = expr.split(/=(.+)/, 2);
  if (s.length === 2) {
    acc[s[0]] = toIntIfInt(s[1]);
  }
  return acc;
};

exports.parseParams = function (str) {
  return str.split(/\;\s?/).reduce(paramReducer, {});
};

// For backward compatibility - alias will be removed in 3.0.0
exports.parseFmtpConfig = exports.parseParams;

exports.parsePayloads = function (str) {
  return str.split(' ').map(Number);
};

exports.parseRemoteCandidates = function (str) {
  var candidates = [];
  var parts = str.split(' ').map(toIntIfInt);
  for (var i = 0; i < parts.length; i += 3) {
    candidates.push({
      component: parts[i],
      ip: parts[i + 1],
      port: parts[i + 2]
    });
  }
  return candidates;
};

exports.parseImageAttributes = function (str) {
  return str.split(' ').map(function (item) {
    return item.substring(1, item.length-1).split(',').reduce(paramReducer, {});
  });
};

exports.parseSimulcastStreamList = function (str) {
  return str.split(';').map(function (stream) {
    return stream.split(',').map(function (format) {
      var scid, paused = false;

      if (format[0] !== '~') {
        scid = toIntIfInt(format);
      } else {
        scid = toIntIfInt(format.substring(1, format.length));
        paused = true;
      }

      return {
        scid: scid,
        paused: paused
      };
    });
  });
};

},{"./grammar":16}],19:[function(require,module,exports){
var grammar = require('./grammar');

// customized util.format - discards excess arguments and can void middle ones
var formatRegExp = /%[sdv%]/g;
var format = function (formatStr) {
  var i = 1;
  var args = arguments;
  var len = args.length;
  return formatStr.replace(formatRegExp, function (x) {
    if (i >= len) {
      return x; // missing argument
    }
    var arg = args[i];
    i += 1;
    switch (x) {
    case '%%':
      return '%';
    case '%s':
      return String(arg);
    case '%d':
      return Number(arg);
    case '%v':
      return '';
    }
  });
  // NB: we discard excess arguments - they are typically undefined from makeLine
};

var makeLine = function (type, obj, location) {
  var str = obj.format instanceof Function ?
    (obj.format(obj.push ? location : location[obj.name])) :
    obj.format;

  var args = [type + '=' + str];
  if (obj.names) {
    for (var i = 0; i < obj.names.length; i += 1) {
      var n = obj.names[i];
      if (obj.name) {
        args.push(location[obj.name][n]);
      }
      else { // for mLine and push attributes
        args.push(location[obj.names[i]]);
      }
    }
  }
  else {
    args.push(location[obj.name]);
  }
  return format.apply(null, args);
};

// RFC specified order
// TODO: extend this with all the rest
var defaultOuterOrder = [
  'v', 'o', 's', 'i',
  'u', 'e', 'p', 'c',
  'b', 't', 'r', 'z', 'a'
];
var defaultInnerOrder = ['i', 'c', 'b', 'a'];


module.exports = function (session, opts) {
  opts = opts || {};
  // ensure certain properties exist
  if (session.version == null) {
    session.version = 0; // 'v=0' must be there (only defined version atm)
  }
  if (session.name == null) {
    session.name = ' '; // 's= ' must be there if no meaningful name set
  }
  session.media.forEach(function (mLine) {
    if (mLine.payloads == null) {
      mLine.payloads = '';
    }
  });

  var outerOrder = opts.outerOrder || defaultOuterOrder;
  var innerOrder = opts.innerOrder || defaultInnerOrder;
  var sdp = [];

  // loop through outerOrder for matching properties on session
  outerOrder.forEach(function (type) {
    grammar[type].forEach(function (obj) {
      if (obj.name in session && session[obj.name] != null) {
        sdp.push(makeLine(type, obj, session));
      }
      else if (obj.push in session && session[obj.push] != null) {
        session[obj.push].forEach(function (el) {
          sdp.push(makeLine(type, obj, el));
        });
      }
    });
  });

  // then for each media line, follow the innerOrder
  session.media.forEach(function (mLine) {
    sdp.push(makeLine('m', grammar.m[0], mLine));

    innerOrder.forEach(function (type) {
      grammar[type].forEach(function (obj) {
        if (obj.name in mLine && mLine[obj.name] != null) {
          sdp.push(makeLine(type, obj, mLine));
        }
        else if (obj.push in mLine && mLine[obj.push] != null) {
          mLine[obj.push].forEach(function (el) {
            sdp.push(makeLine(type, obj, el));
          });
        }
      });
    });
  });

  return sdp.join('\r\n') + '\r\n';
};

},{"./grammar":16}],20:[function(require,module,exports){
 /* eslint-env node */
'use strict';

// SDP helpers.
var SDPUtils = {};

// Generate an alphanumeric identifier for cname or mids.
// TODO: use UUIDs instead? https://gist.github.com/jed/982883
SDPUtils.generateIdentifier = function() {
  return Math.random().toString(36).substr(2, 10);
};

// The RTCP CNAME used by all peerconnections from the same JS.
SDPUtils.localCName = SDPUtils.generateIdentifier();

// Splits SDP into lines, dealing with both CRLF and LF.
SDPUtils.splitLines = function(blob) {
  return blob.trim().split('\n').map(function(line) {
    return line.trim();
  });
};
// Splits SDP into sessionpart and mediasections. Ensures CRLF.
SDPUtils.splitSections = function(blob) {
  var parts = blob.split('\nm=');
  return parts.map(function(part, index) {
    return (index > 0 ? 'm=' + part : part).trim() + '\r\n';
  });
};

// Returns lines that start with a certain prefix.
SDPUtils.matchPrefix = function(blob, prefix) {
  return SDPUtils.splitLines(blob).filter(function(line) {
    return line.indexOf(prefix) === 0;
  });
};

// Parses an ICE candidate line. Sample input:
// candidate:702786350 2 udp 41819902 8.8.8.8 60769 typ relay raddr 8.8.8.8
// rport 55996"
SDPUtils.parseCandidate = function(line) {
  var parts;
  // Parse both variants.
  if (line.indexOf('a=candidate:') === 0) {
    parts = line.substring(12).split(' ');
  } else {
    parts = line.substring(10).split(' ');
  }

  var candidate = {
    foundation: parts[0],
    component: parts[1],
    protocol: parts[2].toLowerCase(),
    priority: parseInt(parts[3], 10),
    ip: parts[4],
    port: parseInt(parts[5], 10),
    // skip parts[6] == 'typ'
    type: parts[7]
  };

  for (var i = 8; i < parts.length; i += 2) {
    switch (parts[i]) {
      case 'raddr':
        candidate.relatedAddress = parts[i + 1];
        break;
      case 'rport':
        candidate.relatedPort = parseInt(parts[i + 1], 10);
        break;
      case 'tcptype':
        candidate.tcpType = parts[i + 1];
        break;
      default: // extension handling, in particular ufrag
        candidate[parts[i]] = parts[i + 1];
        break;
    }
  }
  return candidate;
};

// Translates a candidate object into SDP candidate attribute.
SDPUtils.writeCandidate = function(candidate) {
  var sdp = [];
  sdp.push(candidate.foundation);
  sdp.push(candidate.component);
  sdp.push(candidate.protocol.toUpperCase());
  sdp.push(candidate.priority);
  sdp.push(candidate.ip);
  sdp.push(candidate.port);

  var type = candidate.type;
  sdp.push('typ');
  sdp.push(type);
  if (type !== 'host' && candidate.relatedAddress &&
      candidate.relatedPort) {
    sdp.push('raddr');
    sdp.push(candidate.relatedAddress); // was: relAddr
    sdp.push('rport');
    sdp.push(candidate.relatedPort); // was: relPort
  }
  if (candidate.tcpType && candidate.protocol.toLowerCase() === 'tcp') {
    sdp.push('tcptype');
    sdp.push(candidate.tcpType);
  }
  return 'candidate:' + sdp.join(' ');
};

// Parses an ice-options line, returns an array of option tags.
// a=ice-options:foo bar
SDPUtils.parseIceOptions = function(line) {
  return line.substr(14).split(' ');
}

// Parses an rtpmap line, returns RTCRtpCoddecParameters. Sample input:
// a=rtpmap:111 opus/48000/2
SDPUtils.parseRtpMap = function(line) {
  var parts = line.substr(9).split(' ');
  var parsed = {
    payloadType: parseInt(parts.shift(), 10) // was: id
  };

  parts = parts[0].split('/');

  parsed.name = parts[0];
  parsed.clockRate = parseInt(parts[1], 10); // was: clockrate
  // was: channels
  parsed.numChannels = parts.length === 3 ? parseInt(parts[2], 10) : 1;
  return parsed;
};

// Generate an a=rtpmap line from RTCRtpCodecCapability or
// RTCRtpCodecParameters.
SDPUtils.writeRtpMap = function(codec) {
  var pt = codec.payloadType;
  if (codec.preferredPayloadType !== undefined) {
    pt = codec.preferredPayloadType;
  }
  return 'a=rtpmap:' + pt + ' ' + codec.name + '/' + codec.clockRate +
      (codec.numChannels !== 1 ? '/' + codec.numChannels : '') + '\r\n';
};

// Parses an a=extmap line (headerextension from RFC 5285). Sample input:
// a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
// a=extmap:2/sendonly urn:ietf:params:rtp-hdrext:toffset
SDPUtils.parseExtmap = function(line) {
  var parts = line.substr(9).split(' ');
  return {
    id: parseInt(parts[0], 10),
    direction: parts[0].indexOf('/') > 0 ? parts[0].split('/')[1] : 'sendrecv',
    uri: parts[1]
  };
};

// Generates a=extmap line from RTCRtpHeaderExtensionParameters or
// RTCRtpHeaderExtension.
SDPUtils.writeExtmap = function(headerExtension) {
  return 'a=extmap:' + (headerExtension.id || headerExtension.preferredId) +
      (headerExtension.direction && headerExtension.direction !== 'sendrecv'
          ? '/' + headerExtension.direction
          : '') +
      ' ' + headerExtension.uri + '\r\n';
};

// Parses an ftmp line, returns dictionary. Sample input:
// a=fmtp:96 vbr=on;cng=on
// Also deals with vbr=on; cng=on
SDPUtils.parseFmtp = function(line) {
  var parsed = {};
  var kv;
  var parts = line.substr(line.indexOf(' ') + 1).split(';');
  for (var j = 0; j < parts.length; j++) {
    kv = parts[j].trim().split('=');
    parsed[kv[0].trim()] = kv[1];
  }
  return parsed;
};

// Generates an a=ftmp line from RTCRtpCodecCapability or RTCRtpCodecParameters.
SDPUtils.writeFmtp = function(codec) {
  var line = '';
  var pt = codec.payloadType;
  if (codec.preferredPayloadType !== undefined) {
    pt = codec.preferredPayloadType;
  }
  if (codec.parameters && Object.keys(codec.parameters).length) {
    var params = [];
    Object.keys(codec.parameters).forEach(function(param) {
      params.push(param + '=' + codec.parameters[param]);
    });
    line += 'a=fmtp:' + pt + ' ' + params.join(';') + '\r\n';
  }
  return line;
};

// Parses an rtcp-fb line, returns RTCPRtcpFeedback object. Sample input:
// a=rtcp-fb:98 nack rpsi
SDPUtils.parseRtcpFb = function(line) {
  var parts = line.substr(line.indexOf(' ') + 1).split(' ');
  return {
    type: parts.shift(),
    parameter: parts.join(' ')
  };
};
// Generate a=rtcp-fb lines from RTCRtpCodecCapability or RTCRtpCodecParameters.
SDPUtils.writeRtcpFb = function(codec) {
  var lines = '';
  var pt = codec.payloadType;
  if (codec.preferredPayloadType !== undefined) {
    pt = codec.preferredPayloadType;
  }
  if (codec.rtcpFeedback && codec.rtcpFeedback.length) {
    // FIXME: special handling for trr-int?
    codec.rtcpFeedback.forEach(function(fb) {
      lines += 'a=rtcp-fb:' + pt + ' ' + fb.type +
      (fb.parameter && fb.parameter.length ? ' ' + fb.parameter : '') +
          '\r\n';
    });
  }
  return lines;
};

// Parses an RFC 5576 ssrc media attribute. Sample input:
// a=ssrc:3735928559 cname:something
SDPUtils.parseSsrcMedia = function(line) {
  var sp = line.indexOf(' ');
  var parts = {
    ssrc: parseInt(line.substr(7, sp - 7), 10)
  };
  var colon = line.indexOf(':', sp);
  if (colon > -1) {
    parts.attribute = line.substr(sp + 1, colon - sp - 1);
    parts.value = line.substr(colon + 1);
  } else {
    parts.attribute = line.substr(sp + 1);
  }
  return parts;
};

// Extracts the MID (RFC 5888) from a media section.
// returns the MID or undefined if no mid line was found.
SDPUtils.getMid = function(mediaSection) {
  var mid = SDPUtils.matchPrefix(mediaSection, 'a=mid:')[0];
  if (mid) {
    return mid.substr(6);
  }
}

SDPUtils.parseFingerprint = function(line) {
  var parts = line.substr(14).split(' ');
  return {
    algorithm: parts[0].toLowerCase(), // algorithm is case-sensitive in Edge.
    value: parts[1]
  };
};

// Extracts DTLS parameters from SDP media section or sessionpart.
// FIXME: for consistency with other functions this should only
//   get the fingerprint line as input. See also getIceParameters.
SDPUtils.getDtlsParameters = function(mediaSection, sessionpart) {
  var lines = SDPUtils.matchPrefix(mediaSection + sessionpart,
      'a=fingerprint:');
  // Note: a=setup line is ignored since we use the 'auto' role.
  // Note2: 'algorithm' is not case sensitive except in Edge.
  return {
    role: 'auto',
    fingerprints: lines.map(SDPUtils.parseFingerprint)
  };
};

// Serializes DTLS parameters to SDP.
SDPUtils.writeDtlsParameters = function(params, setupType) {
  var sdp = 'a=setup:' + setupType + '\r\n';
  params.fingerprints.forEach(function(fp) {
    sdp += 'a=fingerprint:' + fp.algorithm + ' ' + fp.value + '\r\n';
  });
  return sdp;
};
// Parses ICE information from SDP media section or sessionpart.
// FIXME: for consistency with other functions this should only
//   get the ice-ufrag and ice-pwd lines as input.
SDPUtils.getIceParameters = function(mediaSection, sessionpart) {
  var lines = SDPUtils.splitLines(mediaSection);
  // Search in session part, too.
  lines = lines.concat(SDPUtils.splitLines(sessionpart));
  var iceParameters = {
    usernameFragment: lines.filter(function(line) {
      return line.indexOf('a=ice-ufrag:') === 0;
    })[0].substr(12),
    password: lines.filter(function(line) {
      return line.indexOf('a=ice-pwd:') === 0;
    })[0].substr(10)
  };
  return iceParameters;
};

// Serializes ICE parameters to SDP.
SDPUtils.writeIceParameters = function(params) {
  return 'a=ice-ufrag:' + params.usernameFragment + '\r\n' +
      'a=ice-pwd:' + params.password + '\r\n';
};

// Parses the SDP media section and returns RTCRtpParameters.
SDPUtils.parseRtpParameters = function(mediaSection) {
  var description = {
    codecs: [],
    headerExtensions: [],
    fecMechanisms: [],
    rtcp: []
  };
  var lines = SDPUtils.splitLines(mediaSection);
  var mline = lines[0].split(' ');
  for (var i = 3; i < mline.length; i++) { // find all codecs from mline[3..]
    var pt = mline[i];
    var rtpmapline = SDPUtils.matchPrefix(
        mediaSection, 'a=rtpmap:' + pt + ' ')[0];
    if (rtpmapline) {
      var codec = SDPUtils.parseRtpMap(rtpmapline);
      var fmtps = SDPUtils.matchPrefix(
          mediaSection, 'a=fmtp:' + pt + ' ');
      // Only the first a=fmtp:<pt> is considered.
      codec.parameters = fmtps.length ? SDPUtils.parseFmtp(fmtps[0]) : {};
      codec.rtcpFeedback = SDPUtils.matchPrefix(
          mediaSection, 'a=rtcp-fb:' + pt + ' ')
        .map(SDPUtils.parseRtcpFb);
      description.codecs.push(codec);
      // parse FEC mechanisms from rtpmap lines.
      switch (codec.name.toUpperCase()) {
        case 'RED':
        case 'ULPFEC':
          description.fecMechanisms.push(codec.name.toUpperCase());
          break;
        default: // only RED and ULPFEC are recognized as FEC mechanisms.
          break;
      }
    }
  }
  SDPUtils.matchPrefix(mediaSection, 'a=extmap:').forEach(function(line) {
    description.headerExtensions.push(SDPUtils.parseExtmap(line));
  });
  // FIXME: parse rtcp.
  return description;
};

// Generates parts of the SDP media section describing the capabilities /
// parameters.
SDPUtils.writeRtpDescription = function(kind, caps) {
  var sdp = '';

  // Build the mline.
  sdp += 'm=' + kind + ' ';
  sdp += caps.codecs.length > 0 ? '9' : '0'; // reject if no codecs.
  sdp += ' UDP/TLS/RTP/SAVPF ';
  sdp += caps.codecs.map(function(codec) {
    if (codec.preferredPayloadType !== undefined) {
      return codec.preferredPayloadType;
    }
    return codec.payloadType;
  }).join(' ') + '\r\n';

  sdp += 'c=IN IP4 0.0.0.0\r\n';
  sdp += 'a=rtcp:9 IN IP4 0.0.0.0\r\n';

  // Add a=rtpmap lines for each codec. Also fmtp and rtcp-fb.
  caps.codecs.forEach(function(codec) {
    sdp += SDPUtils.writeRtpMap(codec);
    sdp += SDPUtils.writeFmtp(codec);
    sdp += SDPUtils.writeRtcpFb(codec);
  });
  var maxptime = 0;
  caps.codecs.forEach(function(codec) {
    if (codec.maxptime > maxptime) {
      maxptime = codec.maxptime;
    }
  });
  if (maxptime > 0) {
    sdp += 'a=maxptime:' + maxptime + '\r\n';
  }
  sdp += 'a=rtcp-mux\r\n';

  caps.headerExtensions.forEach(function(extension) {
    sdp += SDPUtils.writeExtmap(extension);
  });
  // FIXME: write fecMechanisms.
  return sdp;
};

// Parses the SDP media section and returns an array of
// RTCRtpEncodingParameters.
SDPUtils.parseRtpEncodingParameters = function(mediaSection) {
  var encodingParameters = [];
  var description = SDPUtils.parseRtpParameters(mediaSection);
  var hasRed = description.fecMechanisms.indexOf('RED') !== -1;
  var hasUlpfec = description.fecMechanisms.indexOf('ULPFEC') !== -1;

  // filter a=ssrc:... cname:, ignore PlanB-msid
  var ssrcs = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
  .map(function(line) {
    return SDPUtils.parseSsrcMedia(line);
  })
  .filter(function(parts) {
    return parts.attribute === 'cname';
  });
  var primarySsrc = ssrcs.length > 0 && ssrcs[0].ssrc;
  var secondarySsrc;

  var flows = SDPUtils.matchPrefix(mediaSection, 'a=ssrc-group:FID')
  .map(function(line) {
    var parts = line.split(' ');
    parts.shift();
    return parts.map(function(part) {
      return parseInt(part, 10);
    });
  });
  if (flows.length > 0 && flows[0].length > 1 && flows[0][0] === primarySsrc) {
    secondarySsrc = flows[0][1];
  }

  description.codecs.forEach(function(codec) {
    if (codec.name.toUpperCase() === 'RTX' && codec.parameters.apt) {
      var encParam = {
        ssrc: primarySsrc,
        codecPayloadType: parseInt(codec.parameters.apt, 10),
        rtx: {
          ssrc: secondarySsrc
        }
      };
      encodingParameters.push(encParam);
      if (hasRed) {
        encParam = JSON.parse(JSON.stringify(encParam));
        encParam.fec = {
          ssrc: secondarySsrc,
          mechanism: hasUlpfec ? 'red+ulpfec' : 'red'
        };
        encodingParameters.push(encParam);
      }
    }
  });
  if (encodingParameters.length === 0 && primarySsrc) {
    encodingParameters.push({
      ssrc: primarySsrc
    });
  }

  // we support both b=AS and b=TIAS but interpret AS as TIAS.
  var bandwidth = SDPUtils.matchPrefix(mediaSection, 'b=');
  if (bandwidth.length) {
    if (bandwidth[0].indexOf('b=TIAS:') === 0) {
      bandwidth = parseInt(bandwidth[0].substr(7), 10);
    } else if (bandwidth[0].indexOf('b=AS:') === 0) {
      bandwidth = parseInt(bandwidth[0].substr(5), 10);
    }
    encodingParameters.forEach(function(params) {
      params.maxBitrate = bandwidth;
    });
  }
  return encodingParameters;
};

// parses http://draft.ortc.org/#rtcrtcpparameters*
SDPUtils.parseRtcpParameters = function(mediaSection) {
  var rtcpParameters = {};

  var cname;
  // Gets the first SSRC. Note that with RTX there might be multiple
  // SSRCs.
  var remoteSsrc = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
      .map(function(line) {
        return SDPUtils.parseSsrcMedia(line);
      })
      .filter(function(obj) {
        return obj.attribute === 'cname';
      })[0];
  if (remoteSsrc) {
    rtcpParameters.cname = remoteSsrc.value;
    rtcpParameters.ssrc = remoteSsrc.ssrc;
  }

  // Edge uses the compound attribute instead of reducedSize
  // compound is !reducedSize
  var rsize = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-rsize');
  rtcpParameters.reducedSize = rsize.length > 0;
  rtcpParameters.compound = rsize.length === 0;

  // parses the rtcp-mux attrіbute.
  // Note that Edge does not support unmuxed RTCP.
  var mux = SDPUtils.matchPrefix(mediaSection, 'a=rtcp-mux');
  rtcpParameters.mux = mux.length > 0;

  return rtcpParameters;
};

// parses either a=msid: or a=ssrc:... msid lines and returns
// the id of the MediaStream and MediaStreamTrack.
SDPUtils.parseMsid = function(mediaSection) {
  var parts;
  var spec = SDPUtils.matchPrefix(mediaSection, 'a=msid:');
  if (spec.length === 1) {
    parts = spec[0].substr(7).split(' ');
    return {stream: parts[0], track: parts[1]};
  }
  var planB = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
  .map(function(line) {
    return SDPUtils.parseSsrcMedia(line);
  })
  .filter(function(parts) {
    return parts.attribute === 'msid';
  });
  if (planB.length > 0) {
    parts = planB[0].value.split(' ');
    return {stream: parts[0], track: parts[1]};
  }
};

SDPUtils.writeSessionBoilerplate = function() {
  // FIXME: sess-id should be an NTP timestamp.
  return 'v=0\r\n' +
      'o=thisisadapterortc 8169639915646943137 2 IN IP4 127.0.0.1\r\n' +
      's=-\r\n' +
      't=0 0\r\n';
};

SDPUtils.writeMediaSection = function(transceiver, caps, type, stream) {
  var sdp = SDPUtils.writeRtpDescription(transceiver.kind, caps);

  // Map ICE parameters (ufrag, pwd) to SDP.
  sdp += SDPUtils.writeIceParameters(
      transceiver.iceGatherer.getLocalParameters());

  // Map DTLS parameters to SDP.
  sdp += SDPUtils.writeDtlsParameters(
      transceiver.dtlsTransport.getLocalParameters(),
      type === 'offer' ? 'actpass' : 'active');

  sdp += 'a=mid:' + transceiver.mid + '\r\n';

  if (transceiver.direction) {
    sdp += 'a=' + transceiver.direction + '\r\n';
  } else if (transceiver.rtpSender && transceiver.rtpReceiver) {
    sdp += 'a=sendrecv\r\n';
  } else if (transceiver.rtpSender) {
    sdp += 'a=sendonly\r\n';
  } else if (transceiver.rtpReceiver) {
    sdp += 'a=recvonly\r\n';
  } else {
    sdp += 'a=inactive\r\n';
  }

  if (transceiver.rtpSender) {
    // spec.
    var msid = 'msid:' + stream.id + ' ' +
        transceiver.rtpSender.track.id + '\r\n';
    sdp += 'a=' + msid;

    // for Chrome.
    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
        ' ' + msid;
    if (transceiver.sendEncodingParameters[0].rtx) {
      sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
          ' ' + msid;
      sdp += 'a=ssrc-group:FID ' +
          transceiver.sendEncodingParameters[0].ssrc + ' ' +
          transceiver.sendEncodingParameters[0].rtx.ssrc +
          '\r\n';
    }
  }
  // FIXME: this should be written by writeRtpDescription.
  sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
      ' cname:' + SDPUtils.localCName + '\r\n';
  if (transceiver.rtpSender && transceiver.sendEncodingParameters[0].rtx) {
    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].rtx.ssrc +
        ' cname:' + SDPUtils.localCName + '\r\n';
  }
  return sdp;
};

// Gets the direction from the mediaSection or the sessionpart.
SDPUtils.getDirection = function(mediaSection, sessionpart) {
  // Look for sendrecv, sendonly, recvonly, inactive, default to sendrecv.
  var lines = SDPUtils.splitLines(mediaSection);
  for (var i = 0; i < lines.length; i++) {
    switch (lines[i]) {
      case 'a=sendrecv':
      case 'a=sendonly':
      case 'a=recvonly':
      case 'a=inactive':
        return lines[i].substr(2);
      default:
        // FIXME: What should happen here?
    }
  }
  if (sessionpart) {
    return SDPUtils.getDirection(sessionpart);
  }
  return 'sendrecv';
};

SDPUtils.getKind = function(mediaSection) {
  var lines = SDPUtils.splitLines(mediaSection);
  var mline = lines[0].split(' ');
  return mline[0].substr(2);
};

SDPUtils.isRejected = function(mediaSection) {
  return mediaSection.split(' ', 2)[1] === '0';
};

// Expose public methods.
module.exports = SDPUtils;

},{}],21:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],22:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],23:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":22,"_process":15,"inherits":21}],24:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */

'use strict';

// Shimming starts here.
(function() {
  // Utils.
  var utils = require('./utils');
  var logging = utils.log;
  var browserDetails = utils.browserDetails;
  // Export to the adapter global object visible in the browser.
  module.exports.browserDetails = browserDetails;
  module.exports.extractVersion = utils.extractVersion;
  module.exports.disableLog = utils.disableLog;

  // Uncomment the line below if you want logging to occur, including logging
  // for the switch statement below. Can also be turned on in the browser via
  // adapter.disableLog(false), but then logging from the switch statement below
  // will not appear.
  // require('./utils').disableLog(false);

  // Browser shims.
  var chromeShim = require('./chrome/chrome_shim') || null;
  var edgeShim = require('./edge/edge_shim') || null;
  var firefoxShim = require('./firefox/firefox_shim') || null;
  var safariShim = require('./safari/safari_shim') || null;

  // Shim browser if found.
  switch (browserDetails.browser) {
    case 'chrome':
      if (!chromeShim || !chromeShim.shimPeerConnection) {
        logging('Chrome shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming chrome.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = chromeShim;

      chromeShim.shimGetUserMedia();
      chromeShim.shimMediaStream();
      utils.shimCreateObjectURL();
      chromeShim.shimSourceObject();
      chromeShim.shimPeerConnection();
      chromeShim.shimOnTrack();
      chromeShim.shimGetSendersWithDtmf();
      break;
    case 'firefox':
      if (!firefoxShim || !firefoxShim.shimPeerConnection) {
        logging('Firefox shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming firefox.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = firefoxShim;

      firefoxShim.shimGetUserMedia();
      utils.shimCreateObjectURL();
      firefoxShim.shimSourceObject();
      firefoxShim.shimPeerConnection();
      firefoxShim.shimOnTrack();
      break;
    case 'edge':
      if (!edgeShim || !edgeShim.shimPeerConnection) {
        logging('MS edge shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming edge.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = edgeShim;

      edgeShim.shimGetUserMedia();
      utils.shimCreateObjectURL();
      edgeShim.shimPeerConnection();
      edgeShim.shimReplaceTrack();
      break;
    case 'safari':
      if (!safariShim) {
        logging('Safari shim is not included in this adapter release.');
        return;
      }
      logging('adapter.js shimming safari.');
      // Export to the adapter global object visible in the browser.
      module.exports.browserShim = safariShim;

      safariShim.shimCallbacksAPI();
      safariShim.shimAddStream();
      safariShim.shimOnAddStream();
      safariShim.shimGetUserMedia();
      break;
    default:
      logging('Unsupported browser!');
  }
})();

},{"./chrome/chrome_shim":25,"./edge/edge_shim":27,"./firefox/firefox_shim":30,"./safari/safari_shim":32,"./utils":33}],25:[function(require,module,exports){

/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';
var logging = require('../utils.js').log;
var browserDetails = require('../utils.js').browserDetails;

var chromeShim = {
  shimMediaStream: function() {
    window.MediaStream = window.MediaStream || window.webkitMediaStream;
  },

  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() {
          return this._ontrack;
        },
        set: function(f) {
          var self = this;
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            // onaddstream does not fire when a track is added to an existing
            // stream. But stream.onaddtrack is implemented so we use that.
            e.stream.addEventListener('addtrack', function(te) {
              var receiver;
              if (RTCPeerConnection.prototype.getReceivers) {
                receiver = self.getReceivers().find(function(r) {
                  return r.track.id === te.track.id;
                });
              } else {
                receiver = {track: te.track};
              }

              var event = new Event('track');
              event.track = te.track;
              event.receiver = receiver;
              event.streams = [e.stream];
              self.dispatchEvent(event);
            });
            e.stream.getTracks().forEach(function(track) {
              var receiver;
              if (RTCPeerConnection.prototype.getReceivers) {
                receiver = self.getReceivers().find(function(r) {
                  return r.track.id === track.id;
                });
              } else {
                receiver = {track: track};
              }
              var event = new Event('track');
              event.track = track;
              event.receiver = receiver;
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimGetSendersWithDtmf: function() {
    if (typeof window === 'object' && window.RTCPeerConnection &&
        !('getSenders' in RTCPeerConnection.prototype) &&
        'createDTMFSender' in RTCPeerConnection.prototype) {
      RTCPeerConnection.prototype.getSenders = function() {
        return this._senders || [];
      };
      var origAddStream = RTCPeerConnection.prototype.addStream;
      var origRemoveStream = RTCPeerConnection.prototype.removeStream;

      if (!RTCPeerConnection.prototype.addTrack) {
        RTCPeerConnection.prototype.addTrack = function(track, stream) {
          var pc = this;
          if (pc.signalingState === 'closed') {
            throw new DOMException(
              'The RTCPeerConnection\'s signalingState is \'closed\'.',
              'InvalidStateError');
          }
          var streams = [].slice.call(arguments, 1);
          if (streams.length !== 1 ||
              !streams[0].getTracks().find(function(t) {
                return t === track;
              })) {
            // this is not fully correct but all we can manage without
            // [[associated MediaStreams]] internal slot.
            throw new DOMException(
              'The adapter.js addTrack polyfill only supports a single ' +
              ' stream which is associated with the specified track.',
              'NotSupportedError');
          }

          pc._senders = pc._senders || [];
          var alreadyExists = pc._senders.find(function(t) {
            return t.track === track;
          });
          if (alreadyExists) {
            throw new DOMException('Track already exists.',
                'InvalidAccessError');
          }

          pc._streams = pc._streams || {};
          var oldStream = pc._streams[stream.id];
          if (oldStream) {
            oldStream.addTrack(track);
            pc.removeStream(oldStream);
            pc.addStream(oldStream);
          } else {
            var newStream = new MediaStream([track]);
            pc._streams[stream.id] = newStream;
            pc.addStream(newStream);
          }

          var sender = {
            track: track,
            get dtmf() {
              if (this._dtmf === undefined) {
                if (track.kind === 'audio') {
                  this._dtmf = pc.createDTMFSender(track);
                } else {
                  this._dtmf = null;
                }
              }
              return this._dtmf;
            }
          };
          pc._senders.push(sender);
          return sender;
        };
      }
      RTCPeerConnection.prototype.addStream = function(stream) {
        var pc = this;
        pc._senders = pc._senders || [];
        origAddStream.apply(pc, [stream]);
        stream.getTracks().forEach(function(track) {
          pc._senders.push({
            track: track,
            get dtmf() {
              if (this._dtmf === undefined) {
                if (track.kind === 'audio') {
                  this._dtmf = pc.createDTMFSender(track);
                } else {
                  this._dtmf = null;
                }
              }
              return this._dtmf;
            }
          });
        });
      };

      RTCPeerConnection.prototype.removeStream = function(stream) {
        var pc = this;
        pc._senders = pc._senders || [];
        origRemoveStream.apply(pc, [stream]);
        stream.getTracks().forEach(function(track) {
          var sender = pc._senders.find(function(s) {
            return s.track === track;
          });
          if (sender) {
            pc._senders.splice(pc._senders.indexOf(sender), 1); // remove sender
          }
        });
      };
    }
  },

  shimSourceObject: function() {
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this._srcObject;
          },
          set: function(stream) {
            var self = this;
            // Use _srcObject as a private property for this shim
            this._srcObject = stream;
            if (this.src) {
              URL.revokeObjectURL(this.src);
            }

            if (!stream) {
              this.src = '';
              return undefined;
            }
            this.src = URL.createObjectURL(stream);
            // We need to recreate the blob url when a track is added or
            // removed. Doing it manually since we want to avoid a recursion.
            stream.addEventListener('addtrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
            stream.addEventListener('removetrack', function() {
              if (self.src) {
                URL.revokeObjectURL(self.src);
              }
              self.src = URL.createObjectURL(stream);
            });
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    // The RTCPeerConnection object.
    if (!window.RTCPeerConnection) {
      window.RTCPeerConnection = function(pcConfig, pcConstraints) {
        // Translate iceTransportPolicy to iceTransports,
        // see https://code.google.com/p/webrtc/issues/detail?id=4869
        // this was fixed in M56 along with unprefixing RTCPeerConnection.
        logging('PeerConnection');
        if (pcConfig && pcConfig.iceTransportPolicy) {
          pcConfig.iceTransports = pcConfig.iceTransportPolicy;
        }

        return new webkitRTCPeerConnection(pcConfig, pcConstraints);
      };
      window.RTCPeerConnection.prototype = webkitRTCPeerConnection.prototype;
      // wrap static methods. Currently just generateCertificate.
      if (webkitRTCPeerConnection.generateCertificate) {
        Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
          get: function() {
            return webkitRTCPeerConnection.generateCertificate;
          }
        });
      }
    } else {
      // migrate from non-spec RTCIceServer.url to RTCIceServer.urls
      var OrigPeerConnection = RTCPeerConnection;
      window.RTCPeerConnection = function(pcConfig, pcConstraints) {
        if (pcConfig && pcConfig.iceServers) {
          var newIceServers = [];
          for (var i = 0; i < pcConfig.iceServers.length; i++) {
            var server = pcConfig.iceServers[i];
            if (!server.hasOwnProperty('urls') &&
                server.hasOwnProperty('url')) {
              console.warn('RTCIceServer.url is deprecated! Use urls instead.');
              server = JSON.parse(JSON.stringify(server));
              server.urls = server.url;
              newIceServers.push(server);
            } else {
              newIceServers.push(pcConfig.iceServers[i]);
            }
          }
          pcConfig.iceServers = newIceServers;
        }
        return new OrigPeerConnection(pcConfig, pcConstraints);
      };
      window.RTCPeerConnection.prototype = OrigPeerConnection.prototype;
      // wrap static methods. Currently just generateCertificate.
      Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
        get: function() {
          return OrigPeerConnection.generateCertificate;
        }
      });
    }

    var origGetStats = RTCPeerConnection.prototype.getStats;
    RTCPeerConnection.prototype.getStats = function(selector,
        successCallback, errorCallback) {
      var self = this;
      var args = arguments;

      // If selector is a function then we are in the old style stats so just
      // pass back the original getStats format to avoid breaking old users.
      if (arguments.length > 0 && typeof selector === 'function') {
        return origGetStats.apply(this, arguments);
      }

      // When spec-style getStats is supported, return those when called with
      // either no arguments or the selector argument is null.
      if (origGetStats.length === 0 && (arguments.length === 0 ||
          typeof arguments[0] !== 'function')) {
        return origGetStats.apply(this, []);
      }

      var fixChromeStats_ = function(response) {
        var standardReport = {};
        var reports = response.result();
        reports.forEach(function(report) {
          var standardStats = {
            id: report.id,
            timestamp: report.timestamp,
            type: {
              localcandidate: 'local-candidate',
              remotecandidate: 'remote-candidate'
            }[report.type] || report.type
          };
          report.names().forEach(function(name) {
            standardStats[name] = report.stat(name);
          });
          standardReport[standardStats.id] = standardStats;
        });

        return standardReport;
      };

      // shim getStats with maplike support
      var makeMapStats = function(stats) {
        return new Map(Object.keys(stats).map(function(key) {
          return [key, stats[key]];
        }));
      };

      if (arguments.length >= 2) {
        var successCallbackWrapper_ = function(response) {
          args[1](makeMapStats(fixChromeStats_(response)));
        };

        return origGetStats.apply(this, [successCallbackWrapper_,
          arguments[0]]);
      }

      // promise-support
      return new Promise(function(resolve, reject) {
        origGetStats.apply(self, [
          function(response) {
            resolve(makeMapStats(fixChromeStats_(response)));
          }, reject]);
      }).then(successCallback, errorCallback);
    };

    // add promise support -- natively available in Chrome 51
    if (browserDetails.version < 51) {
      ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
          .forEach(function(method) {
            var nativeMethod = RTCPeerConnection.prototype[method];
            RTCPeerConnection.prototype[method] = function() {
              var args = arguments;
              var self = this;
              var promise = new Promise(function(resolve, reject) {
                nativeMethod.apply(self, [args[0], resolve, reject]);
              });
              if (args.length < 2) {
                return promise;
              }
              return promise.then(function() {
                args[1].apply(null, []);
              },
              function(err) {
                if (args.length >= 3) {
                  args[2].apply(null, [err]);
                }
              });
            };
          });
    }

    // promise support for createOffer and createAnswer. Available (without
    // bugs) since M52: crbug/619289
    if (browserDetails.version < 52) {
      ['createOffer', 'createAnswer'].forEach(function(method) {
        var nativeMethod = RTCPeerConnection.prototype[method];
        RTCPeerConnection.prototype[method] = function() {
          var self = this;
          if (arguments.length < 1 || (arguments.length === 1 &&
              typeof arguments[0] === 'object')) {
            var opts = arguments.length === 1 ? arguments[0] : undefined;
            return new Promise(function(resolve, reject) {
              nativeMethod.apply(self, [resolve, reject, opts]);
            });
          }
          return nativeMethod.apply(this, arguments);
        };
      });
    }

    // shim implicit creation of RTCSessionDescription/RTCIceCandidate
    ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
        .forEach(function(method) {
          var nativeMethod = RTCPeerConnection.prototype[method];
          RTCPeerConnection.prototype[method] = function() {
            arguments[0] = new ((method === 'addIceCandidate') ?
                RTCIceCandidate : RTCSessionDescription)(arguments[0]);
            return nativeMethod.apply(this, arguments);
          };
        });

    // support for addIceCandidate(null or undefined)
    var nativeAddIceCandidate =
        RTCPeerConnection.prototype.addIceCandidate;
    RTCPeerConnection.prototype.addIceCandidate = function() {
      if (!arguments[0]) {
        if (arguments[1]) {
          arguments[1].apply(null);
        }
        return Promise.resolve();
      }
      return nativeAddIceCandidate.apply(this, arguments);
    };
  }
};


// Expose public methods.
module.exports = {
  shimMediaStream: chromeShim.shimMediaStream,
  shimOnTrack: chromeShim.shimOnTrack,
  shimGetSendersWithDtmf: chromeShim.shimGetSendersWithDtmf,
  shimSourceObject: chromeShim.shimSourceObject,
  shimPeerConnection: chromeShim.shimPeerConnection,
  shimGetUserMedia: require('./getusermedia')
};

},{"../utils.js":33,"./getusermedia":26}],26:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';
var logging = require('../utils.js').log;
var browserDetails = require('../utils.js').browserDetails;

// Expose public methods.
module.exports = function() {
  var constraintsToChrome_ = function(c) {
    if (typeof c !== 'object' || c.mandatory || c.optional) {
      return c;
    }
    var cc = {};
    Object.keys(c).forEach(function(key) {
      if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
        return;
      }
      var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
      if (r.exact !== undefined && typeof r.exact === 'number') {
        r.min = r.max = r.exact;
      }
      var oldname_ = function(prefix, name) {
        if (prefix) {
          return prefix + name.charAt(0).toUpperCase() + name.slice(1);
        }
        return (name === 'deviceId') ? 'sourceId' : name;
      };
      if (r.ideal !== undefined) {
        cc.optional = cc.optional || [];
        var oc = {};
        if (typeof r.ideal === 'number') {
          oc[oldname_('min', key)] = r.ideal;
          cc.optional.push(oc);
          oc = {};
          oc[oldname_('max', key)] = r.ideal;
          cc.optional.push(oc);
        } else {
          oc[oldname_('', key)] = r.ideal;
          cc.optional.push(oc);
        }
      }
      if (r.exact !== undefined && typeof r.exact !== 'number') {
        cc.mandatory = cc.mandatory || {};
        cc.mandatory[oldname_('', key)] = r.exact;
      } else {
        ['min', 'max'].forEach(function(mix) {
          if (r[mix] !== undefined) {
            cc.mandatory = cc.mandatory || {};
            cc.mandatory[oldname_(mix, key)] = r[mix];
          }
        });
      }
    });
    if (c.advanced) {
      cc.optional = (cc.optional || []).concat(c.advanced);
    }
    return cc;
  };

  var shimConstraints_ = function(constraints, func) {
    constraints = JSON.parse(JSON.stringify(constraints));
    if (constraints && constraints.audio) {
      constraints.audio = constraintsToChrome_(constraints.audio);
    }
    if (constraints && typeof constraints.video === 'object') {
      // Shim facingMode for mobile & surface pro.
      var face = constraints.video.facingMode;
      face = face && ((typeof face === 'object') ? face : {ideal: face});
      var getSupportedFacingModeLies = browserDetails.version < 61;

      if ((face && (face.exact === 'user' || face.exact === 'environment' ||
                    face.ideal === 'user' || face.ideal === 'environment')) &&
          !(navigator.mediaDevices.getSupportedConstraints &&
            navigator.mediaDevices.getSupportedConstraints().facingMode &&
            !getSupportedFacingModeLies)) {
        delete constraints.video.facingMode;
        var matches;
        if (face.exact === 'environment' || face.ideal === 'environment') {
          matches = ['back', 'rear'];
        } else if (face.exact === 'user' || face.ideal === 'user') {
          matches = ['front'];
        }
        if (matches) {
          // Look for matches in label, or use last cam for back (typical).
          return navigator.mediaDevices.enumerateDevices()
          .then(function(devices) {
            devices = devices.filter(function(d) {
              return d.kind === 'videoinput';
            });
            var dev = devices.find(function(d) {
              return matches.some(function(match) {
                return d.label.toLowerCase().indexOf(match) !== -1;
              });
            });
            if (!dev && devices.length && matches.indexOf('back') !== -1) {
              dev = devices[devices.length - 1]; // more likely the back cam
            }
            if (dev) {
              constraints.video.deviceId = face.exact ? {exact: dev.deviceId} :
                                                        {ideal: dev.deviceId};
            }
            constraints.video = constraintsToChrome_(constraints.video);
            logging('chrome: ' + JSON.stringify(constraints));
            return func(constraints);
          });
        }
      }
      constraints.video = constraintsToChrome_(constraints.video);
    }
    logging('chrome: ' + JSON.stringify(constraints));
    return func(constraints);
  };

  var shimError_ = function(e) {
    return {
      name: {
        ConstraintNotSatisfiedError: 'OverconstrainedError',
        PermissionDeniedError: 'NotAllowedError',
        TrackStartError: 'NotReadableError'
      }[e.name] || e.name,
      message: e.message,
      constraint: e.constraintName,
      toString: function() {
        return this.name + (this.message && ': ') + this.message;
      }
    };
  };

  var getUserMedia_ = function(constraints, onSuccess, onError) {
    shimConstraints_(constraints, function(c) {
      navigator.webkitGetUserMedia(c, onSuccess, function(e) {
        onError(shimError_(e));
      });
    });
  };

  navigator.getUserMedia = getUserMedia_;

  // Returns the result of getUserMedia as a Promise.
  var getUserMediaPromise_ = function(constraints) {
    return new Promise(function(resolve, reject) {
      navigator.getUserMedia(constraints, resolve, reject);
    });
  };

  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {
      getUserMedia: getUserMediaPromise_,
      enumerateDevices: function() {
        return new Promise(function(resolve) {
          var kinds = {audio: 'audioinput', video: 'videoinput'};
          return MediaStreamTrack.getSources(function(devices) {
            resolve(devices.map(function(device) {
              return {label: device.label,
                kind: kinds[device.kind],
                deviceId: device.id,
                groupId: ''};
            }));
          });
        });
      },
      getSupportedConstraints: function() {
        return {
          deviceId: true, echoCancellation: true, facingMode: true,
          frameRate: true, height: true, width: true
        };
      }
    };
  }

  // A shim for getUserMedia method on the mediaDevices object.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = function(constraints) {
      return getUserMediaPromise_(constraints);
    };
  } else {
    // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
    // function which returns a Promise, it does not accept spec-style
    // constraints.
    var origGetUserMedia = navigator.mediaDevices.getUserMedia.
        bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(cs) {
      return shimConstraints_(cs, function(c) {
        return origGetUserMedia(c).then(function(stream) {
          if (c.audio && !stream.getAudioTracks().length ||
              c.video && !stream.getVideoTracks().length) {
            stream.getTracks().forEach(function(track) {
              track.stop();
            });
            throw new DOMException('', 'NotFoundError');
          }
          return stream;
        }, function(e) {
          return Promise.reject(shimError_(e));
        });
      });
    };
  }

  // Dummy devicechange event methods.
  // TODO(KaptenJansson) remove once implemented in Chrome stable.
  if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
    navigator.mediaDevices.addEventListener = function() {
      logging('Dummy mediaDevices.addEventListener called.');
    };
  }
  if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
    navigator.mediaDevices.removeEventListener = function() {
      logging('Dummy mediaDevices.removeEventListener called.');
    };
  }
};

},{"../utils.js":33}],27:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var browserDetails = require('../utils').browserDetails;
var shimRTCPeerConnection = require('./rtcpeerconnection_shim');

module.exports = {
  shimGetUserMedia: require('./getusermedia'),
  shimPeerConnection: function() {
    if (window.RTCIceGatherer) {
      // ORTC defines an RTCIceCandidate object but no constructor.
      // Not implemented in Edge.
      if (!window.RTCIceCandidate) {
        window.RTCIceCandidate = function(args) {
          return args;
        };
      }
      // ORTC does not have a session description object but
      // other browsers (i.e. Chrome) that will support both PC and ORTC
      // in the future might have this defined already.
      if (!window.RTCSessionDescription) {
        window.RTCSessionDescription = function(args) {
          return args;
        };
      }
      // this adds an additional event listener to MediaStrackTrack that signals
      // when a tracks enabled property was changed. Workaround for a bug in
      // addStream, see below. No longer required in 15025+
      if (browserDetails.version < 15025) {
        var origMSTEnabled = Object.getOwnPropertyDescriptor(
            MediaStreamTrack.prototype, 'enabled');
        Object.defineProperty(MediaStreamTrack.prototype, 'enabled', {
          set: function(value) {
            origMSTEnabled.set.call(this, value);
            var ev = new Event('enabled');
            ev.enabled = value;
            this.dispatchEvent(ev);
          }
        });
      }
    }
    window.RTCPeerConnection = shimRTCPeerConnection(browserDetails.version);
  },
  shimReplaceTrack: function() {
    // ORTC has replaceTrack -- https://github.com/w3c/ortc/issues/614
    if (window.RTCRtpSender && !('replaceTrack' in RTCRtpSender.prototype)) {
      RTCRtpSender.prototype.replaceTrack = RTCRtpSender.prototype.setTrack;
    }
  }
};

},{"../utils":33,"./getusermedia":28,"./rtcpeerconnection_shim":29}],28:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

// Expose public methods.
module.exports = function() {
  var shimError_ = function(e) {
    return {
      name: {PermissionDeniedError: 'NotAllowedError'}[e.name] || e.name,
      message: e.message,
      constraint: e.constraint,
      toString: function() {
        return this.name;
      }
    };
  };

  // getUserMedia error shim.
  var origGetUserMedia = navigator.mediaDevices.getUserMedia.
      bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = function(c) {
    return origGetUserMedia(c).catch(function(e) {
      return Promise.reject(shimError_(e));
    });
  };
};

},{}],29:[function(require,module,exports){
/*
 *  Copyright (c) 2017 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var SDPUtils = require('sdp');

// sort tracks such that they follow an a-v-a-v...
// pattern.
function sortTracks(tracks) {
  var audioTracks = tracks.filter(function(track) {
    return track.kind === 'audio';
  });
  var videoTracks = tracks.filter(function(track) {
    return track.kind === 'video';
  });
  tracks = [];
  while (audioTracks.length || videoTracks.length) {
    if (audioTracks.length) {
      tracks.push(audioTracks.shift());
    }
    if (videoTracks.length) {
      tracks.push(videoTracks.shift());
    }
  }
  return tracks;
}

// Edge does not like
// 1) stun:
// 2) turn: that does not have all of turn:host:port?transport=udp
// 3) turn: with ipv6 addresses
// 4) turn: occurring muliple times
function filterIceServers(iceServers, edgeVersion) {
  var hasTurn = false;
  iceServers = JSON.parse(JSON.stringify(iceServers));
  return iceServers.filter(function(server) {
    if (server && (server.urls || server.url)) {
      var urls = server.urls || server.url;
      if (server.url && !server.urls) {
        console.warn('RTCIceServer.url is deprecated! Use urls instead.');
      }
      var isString = typeof urls === 'string';
      if (isString) {
        urls = [urls];
      }
      urls = urls.filter(function(url) {
        var validTurn = url.indexOf('turn:') === 0 &&
            url.indexOf('transport=udp') !== -1 &&
            url.indexOf('turn:[') === -1 &&
            !hasTurn;

        if (validTurn) {
          hasTurn = true;
          return true;
        }
        return url.indexOf('stun:') === 0 && edgeVersion >= 14393;
      });

      delete server.url;
      server.urls = isString ? urls[0] : urls;
      return !!urls.length;
    }
    return false;
  });
}

// Determines the intersection of local and remote capabilities.
function getCommonCapabilities(localCapabilities, remoteCapabilities) {
  var commonCapabilities = {
    codecs: [],
    headerExtensions: [],
    fecMechanisms: []
  };

  var findCodecByPayloadType = function(pt, codecs) {
    pt = parseInt(pt, 10);
    for (var i = 0; i < codecs.length; i++) {
      if (codecs[i].payloadType === pt ||
          codecs[i].preferredPayloadType === pt) {
        return codecs[i];
      }
    }
  };

  var rtxCapabilityMatches = function(lRtx, rRtx, lCodecs, rCodecs) {
    var lCodec = findCodecByPayloadType(lRtx.parameters.apt, lCodecs);
    var rCodec = findCodecByPayloadType(rRtx.parameters.apt, rCodecs);
    return lCodec && rCodec &&
        lCodec.name.toLowerCase() === rCodec.name.toLowerCase();
  };

  localCapabilities.codecs.forEach(function(lCodec) {
    for (var i = 0; i < remoteCapabilities.codecs.length; i++) {
      var rCodec = remoteCapabilities.codecs[i];
      if (lCodec.name.toLowerCase() === rCodec.name.toLowerCase() &&
          lCodec.clockRate === rCodec.clockRate) {
        if (lCodec.name.toLowerCase() === 'rtx' &&
            lCodec.parameters && rCodec.parameters.apt) {
          // for RTX we need to find the local rtx that has a apt
          // which points to the same local codec as the remote one.
          if (!rtxCapabilityMatches(lCodec, rCodec,
              localCapabilities.codecs, remoteCapabilities.codecs)) {
            continue;
          }
        }
        rCodec = JSON.parse(JSON.stringify(rCodec)); // deepcopy
        // number of channels is the highest common number of channels
        rCodec.numChannels = Math.min(lCodec.numChannels,
            rCodec.numChannels);
        // push rCodec so we reply with offerer payload type
        commonCapabilities.codecs.push(rCodec);

        // determine common feedback mechanisms
        rCodec.rtcpFeedback = rCodec.rtcpFeedback.filter(function(fb) {
          for (var j = 0; j < lCodec.rtcpFeedback.length; j++) {
            if (lCodec.rtcpFeedback[j].type === fb.type &&
                lCodec.rtcpFeedback[j].parameter === fb.parameter) {
              return true;
            }
          }
          return false;
        });
        // FIXME: also need to determine .parameters
        //  see https://github.com/openpeer/ortc/issues/569
        break;
      }
    }
  });

  localCapabilities.headerExtensions.forEach(function(lHeaderExtension) {
    for (var i = 0; i < remoteCapabilities.headerExtensions.length;
         i++) {
      var rHeaderExtension = remoteCapabilities.headerExtensions[i];
      if (lHeaderExtension.uri === rHeaderExtension.uri) {
        commonCapabilities.headerExtensions.push(rHeaderExtension);
        break;
      }
    }
  });

  // FIXME: fecMechanisms
  return commonCapabilities;
}

// is action=setLocalDescription with type allowed in signalingState
function isActionAllowedInSignalingState(action, type, signalingState) {
  return {
    offer: {
      setLocalDescription: ['stable', 'have-local-offer'],
      setRemoteDescription: ['stable', 'have-remote-offer']
    },
    answer: {
      setLocalDescription: ['have-remote-offer', 'have-local-pranswer'],
      setRemoteDescription: ['have-local-offer', 'have-remote-pranswer']
    }
  }[type][action].indexOf(signalingState) !== -1;
}

module.exports = function(edgeVersion) {
  var RTCPeerConnection = function(config) {
    var self = this;

    var _eventTarget = document.createDocumentFragment();
    ['addEventListener', 'removeEventListener', 'dispatchEvent']
        .forEach(function(method) {
          self[method] = _eventTarget[method].bind(_eventTarget);
        });

    this.needNegotiation = false;

    this.onicecandidate = null;
    this.onaddstream = null;
    this.ontrack = null;
    this.onremovestream = null;
    this.onsignalingstatechange = null;
    this.oniceconnectionstatechange = null;
    this.onicegatheringstatechange = null;
    this.onnegotiationneeded = null;
    this.ondatachannel = null;
    this.canTrickleIceCandidates = null;

    this.localStreams = [];
    this.remoteStreams = [];
    this.getLocalStreams = function() {
      return self.localStreams;
    };
    this.getRemoteStreams = function() {
      return self.remoteStreams;
    };

    this.localDescription = new RTCSessionDescription({
      type: '',
      sdp: ''
    });
    this.remoteDescription = new RTCSessionDescription({
      type: '',
      sdp: ''
    });
    this.signalingState = 'stable';
    this.iceConnectionState = 'new';
    this.iceGatheringState = 'new';

    this.iceOptions = {
      gatherPolicy: 'all',
      iceServers: []
    };
    if (config && config.iceTransportPolicy) {
      switch (config.iceTransportPolicy) {
        case 'all':
        case 'relay':
          this.iceOptions.gatherPolicy = config.iceTransportPolicy;
          break;
        default:
          // don't set iceTransportPolicy.
          break;
      }
    }
    this.usingBundle = config && config.bundlePolicy === 'max-bundle';

    if (config && config.iceServers) {
      this.iceOptions.iceServers = filterIceServers(config.iceServers,
          edgeVersion);
    }
    this._config = config || {};

    // per-track iceGathers, iceTransports, dtlsTransports, rtpSenders, ...
    // everything that is needed to describe a SDP m-line.
    this.transceivers = [];

    // since the iceGatherer is currently created in createOffer but we
    // must not emit candidates until after setLocalDescription we buffer
    // them in this array.
    this._localIceCandidatesBuffer = [];
  };

  RTCPeerConnection.prototype._emitGatheringStateChange = function() {
    var event = new Event('icegatheringstatechange');
    this.dispatchEvent(event);
    if (this.onicegatheringstatechange !== null) {
      this.onicegatheringstatechange(event);
    }
  };

  RTCPeerConnection.prototype._emitBufferedCandidates = function() {
    var self = this;
    var sections = SDPUtils.splitSections(self.localDescription.sdp);
    // FIXME: need to apply ice candidates in a way which is async but
    // in-order
    this._localIceCandidatesBuffer.forEach(function(event) {
      var end = !event.candidate || Object.keys(event.candidate).length === 0;
      if (end) {
        for (var j = 1; j < sections.length; j++) {
          if (sections[j].indexOf('\r\na=end-of-candidates\r\n') === -1) {
            sections[j] += 'a=end-of-candidates\r\n';
          }
        }
      } else {
        sections[event.candidate.sdpMLineIndex + 1] +=
            'a=' + event.candidate.candidate + '\r\n';
      }
      self.localDescription.sdp = sections.join('');
      self.dispatchEvent(event);
      if (self.onicecandidate !== null) {
        self.onicecandidate(event);
      }
      if (!event.candidate && self.iceGatheringState !== 'complete') {
        var complete = self.transceivers.every(function(transceiver) {
          return transceiver.iceGatherer &&
              transceiver.iceGatherer.state === 'completed';
        });
        if (complete && self.iceGatheringStateChange !== 'complete') {
          self.iceGatheringState = 'complete';
          self._emitGatheringStateChange();
        }
      }
    });
    this._localIceCandidatesBuffer = [];
  };

  RTCPeerConnection.prototype.getConfiguration = function() {
    return this._config;
  };

  // internal helper to create a transceiver object.
  // (whih is not yet the same as the WebRTC 1.0 transceiver)
  RTCPeerConnection.prototype._createTransceiver = function(kind) {
    var hasBundleTransport = this.transceivers.length > 0;
    var transceiver = {
      track: null,
      iceGatherer: null,
      iceTransport: null,
      dtlsTransport: null,
      localCapabilities: null,
      remoteCapabilities: null,
      rtpSender: null,
      rtpReceiver: null,
      kind: kind,
      mid: null,
      sendEncodingParameters: null,
      recvEncodingParameters: null,
      stream: null,
      wantReceive: true
    };
    if (this.usingBundle && hasBundleTransport) {
      transceiver.iceTransport = this.transceivers[0].iceTransport;
      transceiver.dtlsTransport = this.transceivers[0].dtlsTransport;
    } else {
      var transports = this._createIceAndDtlsTransports();
      transceiver.iceTransport = transports.iceTransport;
      transceiver.dtlsTransport = transports.dtlsTransport;
    }
    this.transceivers.push(transceiver);
    return transceiver;
  };

  RTCPeerConnection.prototype.addTrack = function(track, stream) {
    var transceiver;
    for (var i = 0; i < this.transceivers.length; i++) {
      if (!this.transceivers[i].track &&
          this.transceivers[i].kind === track.kind) {
        transceiver = this.transceivers[i];
      }
    }
    if (!transceiver) {
      transceiver = this._createTransceiver(track.kind);
    }

    transceiver.track = track;
    transceiver.stream = stream;
    transceiver.rtpSender = new RTCRtpSender(track,
        transceiver.dtlsTransport);

    this._maybeFireNegotiationNeeded();
    return transceiver.rtpSender;
  };

  RTCPeerConnection.prototype.addStream = function(stream) {
    var self = this;
    if (edgeVersion >= 15025) {
      this.localStreams.push(stream);
      stream.getTracks().forEach(function(track) {
        self.addTrack(track, stream);
      });
    } else {
      // Clone is necessary for local demos mostly, attaching directly
      // to two different senders does not work (build 10547).
      // Fixed in 15025 (or earlier)
      var clonedStream = stream.clone();
      stream.getTracks().forEach(function(track, idx) {
        var clonedTrack = clonedStream.getTracks()[idx];
        track.addEventListener('enabled', function(event) {
          clonedTrack.enabled = event.enabled;
        });
      });
      clonedStream.getTracks().forEach(function(track) {
        self.addTrack(track, clonedStream);
      });
      this.localStreams.push(clonedStream);
    }
    this._maybeFireNegotiationNeeded();
  };

  RTCPeerConnection.prototype.removeStream = function(stream) {
    var idx = this.localStreams.indexOf(stream);
    if (idx > -1) {
      this.localStreams.splice(idx, 1);
      this._maybeFireNegotiationNeeded();
    }
  };

  RTCPeerConnection.prototype.getSenders = function() {
    return this.transceivers.filter(function(transceiver) {
      return !!transceiver.rtpSender;
    })
    .map(function(transceiver) {
      return transceiver.rtpSender;
    });
  };

  RTCPeerConnection.prototype.getReceivers = function() {
    return this.transceivers.filter(function(transceiver) {
      return !!transceiver.rtpReceiver;
    })
    .map(function(transceiver) {
      return transceiver.rtpReceiver;
    });
  };

  // Create ICE gatherer and hook it up.
  RTCPeerConnection.prototype._createIceGatherer = function(mid,
      sdpMLineIndex) {
    var self = this;
    var iceGatherer = new RTCIceGatherer(self.iceOptions);
    iceGatherer.onlocalcandidate = function(evt) {
      var event = new Event('icecandidate');
      event.candidate = {sdpMid: mid, sdpMLineIndex: sdpMLineIndex};

      var cand = evt.candidate;
      var end = !cand || Object.keys(cand).length === 0;
      // Edge emits an empty object for RTCIceCandidateComplete‥
      if (end) {
        // polyfill since RTCIceGatherer.state is not implemented in
        // Edge 10547 yet.
        if (iceGatherer.state === undefined) {
          iceGatherer.state = 'completed';
        }
      } else {
        // RTCIceCandidate doesn't have a component, needs to be added
        cand.component = 1;
        event.candidate.candidate = SDPUtils.writeCandidate(cand);
      }

      // update local description.
      var sections = SDPUtils.splitSections(self.localDescription.sdp);
      if (!end) {
        sections[event.candidate.sdpMLineIndex + 1] +=
            'a=' + event.candidate.candidate + '\r\n';
      } else {
        sections[event.candidate.sdpMLineIndex + 1] +=
            'a=end-of-candidates\r\n';
      }
      self.localDescription.sdp = sections.join('');
      var transceivers = self._pendingOffer ? self._pendingOffer :
          self.transceivers;
      var complete = transceivers.every(function(transceiver) {
        return transceiver.iceGatherer &&
            transceiver.iceGatherer.state === 'completed';
      });

      // Emit candidate if localDescription is set.
      // Also emits null candidate when all gatherers are complete.
      switch (self.iceGatheringState) {
        case 'new':
          if (!end) {
            self._localIceCandidatesBuffer.push(event);
          }
          if (end && complete) {
            self._localIceCandidatesBuffer.push(
                new Event('icecandidate'));
          }
          break;
        case 'gathering':
          self._emitBufferedCandidates();
          if (!end) {
            self.dispatchEvent(event);
            if (self.onicecandidate !== null) {
              self.onicecandidate(event);
            }
          }
          if (complete) {
            self.dispatchEvent(new Event('icecandidate'));
            if (self.onicecandidate !== null) {
              self.onicecandidate(new Event('icecandidate'));
            }
            self.iceGatheringState = 'complete';
            self._emitGatheringStateChange();
          }
          break;
        case 'complete':
          // should not happen... currently!
          break;
        default: // no-op.
          break;
      }
    };
    return iceGatherer;
  };

  // Create ICE transport and DTLS transport.
  RTCPeerConnection.prototype._createIceAndDtlsTransports = function() {
    var self = this;
    var iceTransport = new RTCIceTransport(null);
    iceTransport.onicestatechange = function() {
      self._updateConnectionState();
    };

    var dtlsTransport = new RTCDtlsTransport(iceTransport);
    dtlsTransport.ondtlsstatechange = function() {
      self._updateConnectionState();
    };
    dtlsTransport.onerror = function() {
      // onerror does not set state to failed by itself.
      Object.defineProperty(dtlsTransport, 'state',
          {value: 'failed', writable: true});
      self._updateConnectionState();
    };

    return {
      iceTransport: iceTransport,
      dtlsTransport: dtlsTransport
    };
  };

  // Destroy ICE gatherer, ICE transport and DTLS transport.
  // Without triggering the callbacks.
  RTCPeerConnection.prototype._disposeIceAndDtlsTransports = function(
      sdpMLineIndex) {
    var iceGatherer = this.transceivers[sdpMLineIndex].iceGatherer;
    if (iceGatherer) {
      delete iceGatherer.onlocalcandidate;
      delete this.transceivers[sdpMLineIndex].iceGatherer;
    }
    var iceTransport = this.transceivers[sdpMLineIndex].iceTransport;
    if (iceTransport) {
      delete iceTransport.onicestatechange;
      delete this.transceivers[sdpMLineIndex].iceTransport;
    }
    var dtlsTransport = this.transceivers[sdpMLineIndex].dtlsTransport;
    if (dtlsTransport) {
      delete dtlsTransport.ondtlssttatechange;
      delete dtlsTransport.onerror;
      delete this.transceivers[sdpMLineIndex].dtlsTransport;
    }
  };

  // Start the RTP Sender and Receiver for a transceiver.
  RTCPeerConnection.prototype._transceive = function(transceiver,
      send, recv) {
    var params = getCommonCapabilities(transceiver.localCapabilities,
        transceiver.remoteCapabilities);
    if (send && transceiver.rtpSender) {
      params.encodings = transceiver.sendEncodingParameters;
      params.rtcp = {
        cname: SDPUtils.localCName,
        compound: transceiver.rtcpParameters.compound
      };
      if (transceiver.recvEncodingParameters.length) {
        params.rtcp.ssrc = transceiver.recvEncodingParameters[0].ssrc;
      }
      transceiver.rtpSender.send(params);
    }
    if (recv && transceiver.rtpReceiver) {
      // remove RTX field in Edge 14942
      if (transceiver.kind === 'video'
          && transceiver.recvEncodingParameters
          && edgeVersion < 15019) {
        transceiver.recvEncodingParameters.forEach(function(p) {
          delete p.rtx;
        });
      }
      params.encodings = transceiver.recvEncodingParameters;
      params.rtcp = {
        cname: transceiver.rtcpParameters.cname,
        compound: transceiver.rtcpParameters.compound
      };
      if (transceiver.sendEncodingParameters.length) {
        params.rtcp.ssrc = transceiver.sendEncodingParameters[0].ssrc;
      }
      transceiver.rtpReceiver.receive(params);
    }
  };

  RTCPeerConnection.prototype.setLocalDescription = function(description) {
    var self = this;

    if (!isActionAllowedInSignalingState('setLocalDescription',
        description.type, this.signalingState)) {
      var e = new Error('Can not set local ' + description.type +
          ' in state ' + this.signalingState);
      e.name = 'InvalidStateError';
      if (arguments.length > 2 && typeof arguments[2] === 'function') {
        window.setTimeout(arguments[2], 0, e);
      }
      return Promise.reject(e);
    }

    var sections;
    var sessionpart;
    if (description.type === 'offer') {
      // FIXME: What was the purpose of this empty if statement?
      // if (!this._pendingOffer) {
      // } else {
      if (this._pendingOffer) {
        // VERY limited support for SDP munging. Limited to:
        // * changing the order of codecs
        sections = SDPUtils.splitSections(description.sdp);
        sessionpart = sections.shift();
        sections.forEach(function(mediaSection, sdpMLineIndex) {
          var caps = SDPUtils.parseRtpParameters(mediaSection);
          self._pendingOffer[sdpMLineIndex].localCapabilities = caps;
        });
        this.transceivers = this._pendingOffer;
        delete this._pendingOffer;
      }
    } else if (description.type === 'answer') {
      sections = SDPUtils.splitSections(self.remoteDescription.sdp);
      sessionpart = sections.shift();
      var isIceLite = SDPUtils.matchPrefix(sessionpart,
          'a=ice-lite').length > 0;
      sections.forEach(function(mediaSection, sdpMLineIndex) {
        var transceiver = self.transceivers[sdpMLineIndex];
        var iceGatherer = transceiver.iceGatherer;
        var iceTransport = transceiver.iceTransport;
        var dtlsTransport = transceiver.dtlsTransport;
        var localCapabilities = transceiver.localCapabilities;
        var remoteCapabilities = transceiver.remoteCapabilities;

        var rejected = SDPUtils.isRejected(mediaSection);

        if (!rejected && !transceiver.isDatachannel) {
          var remoteIceParameters = SDPUtils.getIceParameters(
              mediaSection, sessionpart);
          var remoteDtlsParameters = SDPUtils.getDtlsParameters(
              mediaSection, sessionpart);
          if (isIceLite) {
            remoteDtlsParameters.role = 'server';
          }

          if (!self.usingBundle || sdpMLineIndex === 0) {
            iceTransport.start(iceGatherer, remoteIceParameters,
                isIceLite ? 'controlling' : 'controlled');
            dtlsTransport.start(remoteDtlsParameters);
          }

          // Calculate intersection of capabilities.
          var params = getCommonCapabilities(localCapabilities,
              remoteCapabilities);

          // Start the RTCRtpSender. The RTCRtpReceiver for this
          // transceiver has already been started in setRemoteDescription.
          self._transceive(transceiver,
              params.codecs.length > 0,
              false);
        }
      });
    }

    this.localDescription = {
      type: description.type,
      sdp: description.sdp
    };
    switch (description.type) {
      case 'offer':
        this._updateSignalingState('have-local-offer');
        break;
      case 'answer':
        this._updateSignalingState('stable');
        break;
      default:
        throw new TypeError('unsupported type "' + description.type +
            '"');
    }

    // If a success callback was provided, emit ICE candidates after it
    // has been executed. Otherwise, emit callback after the Promise is
    // resolved.
    var hasCallback = arguments.length > 1 &&
      typeof arguments[1] === 'function';
    if (hasCallback) {
      var cb = arguments[1];
      window.setTimeout(function() {
        cb();
        if (self.iceGatheringState === 'new') {
          self.iceGatheringState = 'gathering';
          self._emitGatheringStateChange();
        }
        self._emitBufferedCandidates();
      }, 0);
    }
    var p = Promise.resolve();
    p.then(function() {
      if (!hasCallback) {
        if (self.iceGatheringState === 'new') {
          self.iceGatheringState = 'gathering';
          self._emitGatheringStateChange();
        }
        // Usually candidates will be emitted earlier.
        window.setTimeout(self._emitBufferedCandidates.bind(self), 500);
      }
    });
    return p;
  };

  RTCPeerConnection.prototype.setRemoteDescription = function(description) {
    var self = this;

    if (!isActionAllowedInSignalingState('setRemoteDescription',
        description.type, this.signalingState)) {
      var e = new Error('Can not set remote ' + description.type +
          ' in state ' + this.signalingState);
      e.name = 'InvalidStateError';
      if (arguments.length > 2 && typeof arguments[2] === 'function') {
        window.setTimeout(arguments[2], 0, e);
      }
      return Promise.reject(e);
    }

    var streams = {};
    var receiverList = [];
    var sections = SDPUtils.splitSections(description.sdp);
    var sessionpart = sections.shift();
    var isIceLite = SDPUtils.matchPrefix(sessionpart,
        'a=ice-lite').length > 0;
    var usingBundle = SDPUtils.matchPrefix(sessionpart,
        'a=group:BUNDLE ').length > 0;
    this.usingBundle = usingBundle;
    var iceOptions = SDPUtils.matchPrefix(sessionpart,
        'a=ice-options:')[0];
    if (iceOptions) {
      this.canTrickleIceCandidates = iceOptions.substr(14).split(' ')
          .indexOf('trickle') >= 0;
    } else {
      this.canTrickleIceCandidates = false;
    }

    sections.forEach(function(mediaSection, sdpMLineIndex) {
      var lines = SDPUtils.splitLines(mediaSection);
      var kind = SDPUtils.getKind(mediaSection);
      var rejected = SDPUtils.isRejected(mediaSection);
      var protocol = lines[0].substr(2).split(' ')[2];

      var direction = SDPUtils.getDirection(mediaSection, sessionpart);
      var remoteMsid = SDPUtils.parseMsid(mediaSection);

      var mid = SDPUtils.getMid(mediaSection) || SDPUtils.generateIdentifier();

      // Reject datachannels which are not implemented yet.
      if (kind === 'application' && protocol === 'DTLS/SCTP') {
        self.transceivers[sdpMLineIndex] = {
          mid: mid,
          isDatachannel: true
        };
        return;
      }

      var transceiver;
      var iceGatherer;
      var iceTransport;
      var dtlsTransport;
      var rtpReceiver;
      var sendEncodingParameters;
      var recvEncodingParameters;
      var localCapabilities;

      var track;
      // FIXME: ensure the mediaSection has rtcp-mux set.
      var remoteCapabilities = SDPUtils.parseRtpParameters(mediaSection);
      var remoteIceParameters;
      var remoteDtlsParameters;
      if (!rejected) {
        remoteIceParameters = SDPUtils.getIceParameters(mediaSection,
            sessionpart);
        remoteDtlsParameters = SDPUtils.getDtlsParameters(mediaSection,
            sessionpart);
        remoteDtlsParameters.role = 'client';
      }
      recvEncodingParameters =
          SDPUtils.parseRtpEncodingParameters(mediaSection);

      var rtcpParameters = SDPUtils.parseRtcpParameters(mediaSection);

      var isComplete = SDPUtils.matchPrefix(mediaSection,
          'a=end-of-candidates', sessionpart).length > 0;
      var cands = SDPUtils.matchPrefix(mediaSection, 'a=candidate:')
          .map(function(cand) {
            return SDPUtils.parseCandidate(cand);
          })
          .filter(function(cand) {
            return cand.component === '1' || cand.component === 1;
          });
      if (description.type === 'offer' && !rejected) {
        transceiver = self.transceivers[sdpMLineIndex] ||
            self._createTransceiver(kind);
        transceiver.mid = mid;

        if (!transceiver.iceGatherer) {
          transceiver.iceGatherer = usingBundle && sdpMLineIndex > 0 ?
              self.transceivers[0].iceGatherer :
              self._createIceGatherer(mid, sdpMLineIndex);
        }

        if (isComplete && (!usingBundle || sdpMLineIndex === 0)) {
          transceiver.iceTransport.setRemoteCandidates(cands);
        }

        localCapabilities = RTCRtpReceiver.getCapabilities(kind);

        // filter RTX until additional stuff needed for RTX is implemented
        // in adapter.js
        if (edgeVersion < 15019) {
          localCapabilities.codecs = localCapabilities.codecs.filter(
              function(codec) {
                return codec.name !== 'rtx';
              });
        }

        sendEncodingParameters = [{
          ssrc: (2 * sdpMLineIndex + 2) * 1001
        }];

        if (direction === 'sendrecv' || direction === 'sendonly') {
          rtpReceiver = new RTCRtpReceiver(transceiver.dtlsTransport,
              kind);

          track = rtpReceiver.track;
          // FIXME: does not work with Plan B.
          if (remoteMsid) {
            if (!streams[remoteMsid.stream]) {
              streams[remoteMsid.stream] = new MediaStream();
              Object.defineProperty(streams[remoteMsid.stream], 'id', {
                get: function() {
                  return remoteMsid.stream;
                }
              });
            }
            Object.defineProperty(track, 'id', {
              get: function() {
                return remoteMsid.track;
              }
            });
            streams[remoteMsid.stream].addTrack(track);
            receiverList.push([track, rtpReceiver,
              streams[remoteMsid.stream]]);
          } else {
            if (!streams.default) {
              streams.default = new MediaStream();
            }
            streams.default.addTrack(track);
            receiverList.push([track, rtpReceiver, streams.default]);
          }
        }

        transceiver.localCapabilities = localCapabilities;
        transceiver.remoteCapabilities = remoteCapabilities;
        transceiver.rtpReceiver = rtpReceiver;
        transceiver.rtcpParameters = rtcpParameters;
        transceiver.sendEncodingParameters = sendEncodingParameters;
        transceiver.recvEncodingParameters = recvEncodingParameters;

        // Start the RTCRtpReceiver now. The RTPSender is started in
        // setLocalDescription.
        self._transceive(self.transceivers[sdpMLineIndex],
            false,
            direction === 'sendrecv' || direction === 'sendonly');
      } else if (description.type === 'answer' && !rejected) {
        if (usingBundle && sdpMLineIndex > 0) {
          self._disposeIceAndDtlsTransports(sdpMLineIndex);
          self.transceivers[sdpMLineIndex].iceGatherer =
              self.transceivers[0].iceGatherer;
          self.transceivers[sdpMLineIndex].iceTransport =
              self.transceivers[0].iceTransport;
          self.transceivers[sdpMLineIndex].dtlsTransport =
              self.transceivers[0].dtlsTransport;
          if (self.transceivers[sdpMLineIndex].rtpSender) {
            self.transceivers[sdpMLineIndex].rtpSender.setTransport(
                self.transceivers[0].dtlsTransport);
          }
          if (self.transceivers[sdpMLineIndex].rtpReceiver) {
            self.transceivers[sdpMLineIndex].rtpReceiver.setTransport(
                self.transceivers[0].dtlsTransport);
          }
        }
        transceiver = self.transceivers[sdpMLineIndex];
        iceGatherer = transceiver.iceGatherer;
        iceTransport = transceiver.iceTransport;
        dtlsTransport = transceiver.dtlsTransport;
        rtpReceiver = transceiver.rtpReceiver;
        sendEncodingParameters = transceiver.sendEncodingParameters;
        localCapabilities = transceiver.localCapabilities;

        self.transceivers[sdpMLineIndex].recvEncodingParameters =
            recvEncodingParameters;
        self.transceivers[sdpMLineIndex].remoteCapabilities =
            remoteCapabilities;
        self.transceivers[sdpMLineIndex].rtcpParameters = rtcpParameters;

        if ((isIceLite || isComplete) && cands.length) {
          iceTransport.setRemoteCandidates(cands);
        }
        if (!usingBundle || sdpMLineIndex === 0) {
          iceTransport.start(iceGatherer, remoteIceParameters,
              'controlling');
          dtlsTransport.start(remoteDtlsParameters);
        }

        self._transceive(transceiver,
            direction === 'sendrecv' || direction === 'recvonly',
            direction === 'sendrecv' || direction === 'sendonly');

        if (rtpReceiver &&
            (direction === 'sendrecv' || direction === 'sendonly')) {
          track = rtpReceiver.track;
          if (remoteMsid) {
            if (!streams[remoteMsid.stream]) {
              streams[remoteMsid.stream] = new MediaStream();
            }
            streams[remoteMsid.stream].addTrack(track);
            receiverList.push([track, rtpReceiver, streams[remoteMsid.stream]]);
          } else {
            if (!streams.default) {
              streams.default = new MediaStream();
            }
            streams.default.addTrack(track);
            receiverList.push([track, rtpReceiver, streams.default]);
          }
        } else {
          // FIXME: actually the receiver should be created later.
          delete transceiver.rtpReceiver;
        }
      }
    });

    this.remoteDescription = {
      type: description.type,
      sdp: description.sdp
    };
    switch (description.type) {
      case 'offer':
        this._updateSignalingState('have-remote-offer');
        break;
      case 'answer':
        this._updateSignalingState('stable');
        break;
      default:
        throw new TypeError('unsupported type "' + description.type +
            '"');
    }
    Object.keys(streams).forEach(function(sid) {
      var stream = streams[sid];
      if (stream.getTracks().length) {
        self.remoteStreams.push(stream);
        var event = new Event('addstream');
        event.stream = stream;
        self.dispatchEvent(event);
        if (self.onaddstream !== null) {
          window.setTimeout(function() {
            self.onaddstream(event);
          }, 0);
        }

        receiverList.forEach(function(item) {
          var track = item[0];
          var receiver = item[1];
          if (stream.id !== item[2].id) {
            return;
          }
          var trackEvent = new Event('track');
          trackEvent.track = track;
          trackEvent.receiver = receiver;
          trackEvent.streams = [stream];
          self.dispatchEvent(trackEvent);
          if (self.ontrack !== null) {
            window.setTimeout(function() {
              self.ontrack(trackEvent);
            }, 0);
          }
        });
      }
    });

    // check whether addIceCandidate({}) was called within four seconds after
    // setRemoteDescription.
    window.setTimeout(function() {
      if (!(self && self.transceivers)) {
        return;
      }
      self.transceivers.forEach(function(transceiver) {
        if (transceiver.iceTransport &&
            transceiver.iceTransport.state === 'new' &&
            transceiver.iceTransport.getRemoteCandidates().length > 0) {
          console.warn('Timeout for addRemoteCandidate. Consider sending ' +
              'an end-of-candidates notification');
          transceiver.iceTransport.addRemoteCandidate({});
        }
      });
    }, 4000);

    if (arguments.length > 1 && typeof arguments[1] === 'function') {
      window.setTimeout(arguments[1], 0);
    }
    return Promise.resolve();
  };

  RTCPeerConnection.prototype.close = function() {
    this.transceivers.forEach(function(transceiver) {
      /* not yet
      if (transceiver.iceGatherer) {
        transceiver.iceGatherer.close();
      }
      */
      if (transceiver.iceTransport) {
        transceiver.iceTransport.stop();
      }
      if (transceiver.dtlsTransport) {
        transceiver.dtlsTransport.stop();
      }
      if (transceiver.rtpSender) {
        transceiver.rtpSender.stop();
      }
      if (transceiver.rtpReceiver) {
        transceiver.rtpReceiver.stop();
      }
    });
    // FIXME: clean up tracks, local streams, remote streams, etc
    this._updateSignalingState('closed');
  };

  // Update the signaling state.
  RTCPeerConnection.prototype._updateSignalingState = function(newState) {
    this.signalingState = newState;
    var event = new Event('signalingstatechange');
    this.dispatchEvent(event);
    if (this.onsignalingstatechange !== null) {
      this.onsignalingstatechange(event);
    }
  };

  // Determine whether to fire the negotiationneeded event.
  RTCPeerConnection.prototype._maybeFireNegotiationNeeded = function() {
    var self = this;
    if (this.signalingState !== 'stable' || this.needNegotiation === true) {
      return;
    }
    this.needNegotiation = true;
    window.setTimeout(function() {
      if (self.needNegotiation === false) {
        return;
      }
      self.needNegotiation = false;
      var event = new Event('negotiationneeded');
      self.dispatchEvent(event);
      if (self.onnegotiationneeded !== null) {
        self.onnegotiationneeded(event);
      }
    }, 0);
  };

  // Update the connection state.
  RTCPeerConnection.prototype._updateConnectionState = function() {
    var self = this;
    var newState;
    var states = {
      'new': 0,
      closed: 0,
      connecting: 0,
      checking: 0,
      connected: 0,
      completed: 0,
      failed: 0
    };
    this.transceivers.forEach(function(transceiver) {
      states[transceiver.iceTransport.state]++;
      states[transceiver.dtlsTransport.state]++;
    });
    // ICETransport.completed and connected are the same for this purpose.
    states.connected += states.completed;

    newState = 'new';
    if (states.failed > 0) {
      newState = 'failed';
    } else if (states.connecting > 0 || states.checking > 0) {
      newState = 'connecting';
    } else if (states.disconnected > 0) {
      newState = 'disconnected';
    } else if (states.new > 0) {
      newState = 'new';
    } else if (states.connected > 0 || states.completed > 0) {
      newState = 'connected';
    }

    if (newState !== self.iceConnectionState) {
      self.iceConnectionState = newState;
      var event = new Event('iceconnectionstatechange');
      this.dispatchEvent(event);
      if (this.oniceconnectionstatechange !== null) {
        this.oniceconnectionstatechange(event);
      }
    }
  };

  RTCPeerConnection.prototype.createOffer = function() {
    var self = this;
    if (this._pendingOffer) {
      throw new Error('createOffer called while there is a pending offer.');
    }
    var offerOptions;
    if (arguments.length === 1 && typeof arguments[0] !== 'function') {
      offerOptions = arguments[0];
    } else if (arguments.length === 3) {
      offerOptions = arguments[2];
    }

    var numAudioTracks = this.transceivers.filter(function(t) {
      return t.kind === 'audio';
    }).length;
    var numVideoTracks = this.transceivers.filter(function(t) {
      return t.kind === 'video';
    }).length;

    // Determine number of audio and video tracks we need to send/recv.
    if (offerOptions) {
      // Reject Chrome legacy constraints.
      if (offerOptions.mandatory || offerOptions.optional) {
        throw new TypeError(
            'Legacy mandatory/optional constraints not supported.');
      }
      if (offerOptions.offerToReceiveAudio !== undefined) {
        if (offerOptions.offerToReceiveAudio === true) {
          numAudioTracks = 1;
        } else if (offerOptions.offerToReceiveAudio === false) {
          numAudioTracks = 0;
        } else {
          numAudioTracks = offerOptions.offerToReceiveAudio;
        }
      }
      if (offerOptions.offerToReceiveVideo !== undefined) {
        if (offerOptions.offerToReceiveVideo === true) {
          numVideoTracks = 1;
        } else if (offerOptions.offerToReceiveVideo === false) {
          numVideoTracks = 0;
        } else {
          numVideoTracks = offerOptions.offerToReceiveVideo;
        }
      }
    }

    this.transceivers.forEach(function(transceiver) {
      if (transceiver.kind === 'audio') {
        numAudioTracks--;
        if (numAudioTracks < 0) {
          transceiver.wantReceive = false;
        }
      } else if (transceiver.kind === 'video') {
        numVideoTracks--;
        if (numVideoTracks < 0) {
          transceiver.wantReceive = false;
        }
      }
    });

    // Create M-lines for recvonly streams.
    while (numAudioTracks > 0 || numVideoTracks > 0) {
      if (numAudioTracks > 0) {
        this._createTransceiver('audio');
        numAudioTracks--;
      }
      if (numVideoTracks > 0) {
        this._createTransceiver('video');
        numVideoTracks--;
      }
    }
    // reorder tracks
    var transceivers = sortTracks(this.transceivers);

    var sdp = SDPUtils.writeSessionBoilerplate();
    transceivers.forEach(function(transceiver, sdpMLineIndex) {
      // For each track, create an ice gatherer, ice transport,
      // dtls transport, potentially rtpsender and rtpreceiver.
      var track = transceiver.track;
      var kind = transceiver.kind;
      var mid = SDPUtils.generateIdentifier();
      transceiver.mid = mid;

      if (!transceiver.iceGatherer) {
        transceiver.iceGatherer = self.usingBundle && sdpMLineIndex > 0 ?
            transceivers[0].iceGatherer :
            self._createIceGatherer(mid, sdpMLineIndex);
      }

      var localCapabilities = RTCRtpSender.getCapabilities(kind);
      // filter RTX until additional stuff needed for RTX is implemented
      // in adapter.js
      if (edgeVersion < 15019) {
        localCapabilities.codecs = localCapabilities.codecs.filter(
            function(codec) {
              return codec.name !== 'rtx';
            });
      }
      localCapabilities.codecs.forEach(function(codec) {
        // work around https://bugs.chromium.org/p/webrtc/issues/detail?id=6552
        // by adding level-asymmetry-allowed=1
        if (codec.name === 'H264' &&
            codec.parameters['level-asymmetry-allowed'] === undefined) {
          codec.parameters['level-asymmetry-allowed'] = '1';
        }
      });

      // generate an ssrc now, to be used later in rtpSender.send
      var sendEncodingParameters = [{
        ssrc: (2 * sdpMLineIndex + 1) * 1001
      }];
      if (track) {
        // add RTX
        if (edgeVersion >= 15019 && kind === 'video') {
          sendEncodingParameters[0].rtx = {
            ssrc: (2 * sdpMLineIndex + 1) * 1001 + 1
          };
        }
      }

      if (transceiver.wantReceive) {
        transceiver.rtpReceiver = new RTCRtpReceiver(transceiver.dtlsTransport,
            kind);
      }

      transceiver.localCapabilities = localCapabilities;
      transceiver.sendEncodingParameters = sendEncodingParameters;
    });

    // always offer BUNDLE and dispose on return if not supported.
    if (this._config.bundlePolicy !== 'max-compat') {
      sdp += 'a=group:BUNDLE ' + transceivers.map(function(t) {
        return t.mid;
      }).join(' ') + '\r\n';
    }
    sdp += 'a=ice-options:trickle\r\n';

    transceivers.forEach(function(transceiver, sdpMLineIndex) {
      sdp += SDPUtils.writeMediaSection(transceiver,
          transceiver.localCapabilities, 'offer', transceiver.stream);
      sdp += 'a=rtcp-rsize\r\n';
    });

    this._pendingOffer = transceivers;
    var desc = new RTCSessionDescription({
      type: 'offer',
      sdp: sdp
    });
    if (arguments.length && typeof arguments[0] === 'function') {
      window.setTimeout(arguments[0], 0, desc);
    }
    return Promise.resolve(desc);
  };

  RTCPeerConnection.prototype.createAnswer = function() {
    var sdp = SDPUtils.writeSessionBoilerplate();
    if (this.usingBundle) {
      sdp += 'a=group:BUNDLE ' + this.transceivers.map(function(t) {
        return t.mid;
      }).join(' ') + '\r\n';
    }
    this.transceivers.forEach(function(transceiver, sdpMLineIndex) {
      if (transceiver.isDatachannel) {
        sdp += 'm=application 0 DTLS/SCTP 5000\r\n' +
            'c=IN IP4 0.0.0.0\r\n' +
            'a=mid:' + transceiver.mid + '\r\n';
        return;
      }

      // FIXME: look at direction.
      if (transceiver.stream) {
        var localTrack;
        if (transceiver.kind === 'audio') {
          localTrack = transceiver.stream.getAudioTracks()[0];
        } else if (transceiver.kind === 'video') {
          localTrack = transceiver.stream.getVideoTracks()[0];
        }
        if (localTrack) {
          // add RTX
          if (edgeVersion >= 15019 && transceiver.kind === 'video') {
            transceiver.sendEncodingParameters[0].rtx = {
              ssrc: (2 * sdpMLineIndex + 2) * 1001 + 1
            };
          }
        }
      }

      // Calculate intersection of capabilities.
      var commonCapabilities = getCommonCapabilities(
          transceiver.localCapabilities,
          transceiver.remoteCapabilities);

      var hasRtx = commonCapabilities.codecs.filter(function(c) {
        return c.name.toLowerCase() === 'rtx';
      }).length;
      if (!hasRtx && transceiver.sendEncodingParameters[0].rtx) {
        delete transceiver.sendEncodingParameters[0].rtx;
      }

      sdp += SDPUtils.writeMediaSection(transceiver, commonCapabilities,
          'answer', transceiver.stream);
      if (transceiver.rtcpParameters &&
          transceiver.rtcpParameters.reducedSize) {
        sdp += 'a=rtcp-rsize\r\n';
      }
    });

    var desc = new RTCSessionDescription({
      type: 'answer',
      sdp: sdp
    });
    if (arguments.length && typeof arguments[0] === 'function') {
      window.setTimeout(arguments[0], 0, desc);
    }
    return Promise.resolve(desc);
  };

  RTCPeerConnection.prototype.addIceCandidate = function(candidate) {
    if (!candidate) {
      for (var j = 0; j < this.transceivers.length; j++) {
        this.transceivers[j].iceTransport.addRemoteCandidate({});
        if (this.usingBundle) {
          return Promise.resolve();
        }
      }
    } else {
      var mLineIndex = candidate.sdpMLineIndex;
      if (candidate.sdpMid) {
        for (var i = 0; i < this.transceivers.length; i++) {
          if (this.transceivers[i].mid === candidate.sdpMid) {
            mLineIndex = i;
            break;
          }
        }
      }
      var transceiver = this.transceivers[mLineIndex];
      if (transceiver) {
        var cand = Object.keys(candidate.candidate).length > 0 ?
            SDPUtils.parseCandidate(candidate.candidate) : {};
        // Ignore Chrome's invalid candidates since Edge does not like them.
        if (cand.protocol === 'tcp' && (cand.port === 0 || cand.port === 9)) {
          return Promise.resolve();
        }
        // Ignore RTCP candidates, we assume RTCP-MUX.
        if (cand.component &&
            !(cand.component === '1' || cand.component === 1)) {
          return Promise.resolve();
        }
        transceiver.iceTransport.addRemoteCandidate(cand);

        // update the remoteDescription.
        var sections = SDPUtils.splitSections(this.remoteDescription.sdp);
        sections[mLineIndex + 1] += (cand.type ? candidate.candidate.trim()
            : 'a=end-of-candidates') + '\r\n';
        this.remoteDescription.sdp = sections.join('');
      }
    }
    if (arguments.length > 1 && typeof arguments[1] === 'function') {
      window.setTimeout(arguments[1], 0);
    }
    return Promise.resolve();
  };

  RTCPeerConnection.prototype.getStats = function() {
    var promises = [];
    this.transceivers.forEach(function(transceiver) {
      ['rtpSender', 'rtpReceiver', 'iceGatherer', 'iceTransport',
        'dtlsTransport'].forEach(function(method) {
          if (transceiver[method]) {
            promises.push(transceiver[method].getStats());
          }
        });
    });
    var cb = arguments.length > 1 && typeof arguments[1] === 'function' &&
        arguments[1];
    var fixStatsType = function(stat) {
      return {
        inboundrtp: 'inbound-rtp',
        outboundrtp: 'outbound-rtp',
        candidatepair: 'candidate-pair',
        localcandidate: 'local-candidate',
        remotecandidate: 'remote-candidate'
      }[stat.type] || stat.type;
    };
    return new Promise(function(resolve) {
      // shim getStats with maplike support
      var results = new Map();
      Promise.all(promises).then(function(res) {
        res.forEach(function(result) {
          Object.keys(result).forEach(function(id) {
            result[id].type = fixStatsType(result[id]);
            results.set(id, result[id]);
          });
        });
        if (cb) {
          window.setTimeout(cb, 0, results);
        }
        resolve(results);
      });
    });
  };
  return RTCPeerConnection;
};

},{"sdp":20}],30:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var browserDetails = require('../utils').browserDetails;

var firefoxShim = {
  shimOnTrack: function() {
    if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
        window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
        get: function() {
          return this._ontrack;
        },
        set: function(f) {
          if (this._ontrack) {
            this.removeEventListener('track', this._ontrack);
            this.removeEventListener('addstream', this._ontrackpoly);
          }
          this.addEventListener('track', this._ontrack = f);
          this.addEventListener('addstream', this._ontrackpoly = function(e) {
            e.stream.getTracks().forEach(function(track) {
              var event = new Event('track');
              event.track = track;
              event.receiver = {track: track};
              event.streams = [e.stream];
              this.dispatchEvent(event);
            }.bind(this));
          }.bind(this));
        }
      });
    }
  },

  shimSourceObject: function() {
    // Firefox has supported mozSrcObject since FF22, unprefixed in 42.
    if (typeof window === 'object') {
      if (window.HTMLMediaElement &&
        !('srcObject' in window.HTMLMediaElement.prototype)) {
        // Shim the srcObject property, once, when HTMLMediaElement is found.
        Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
          get: function() {
            return this.mozSrcObject;
          },
          set: function(stream) {
            this.mozSrcObject = stream;
          }
        });
      }
    }
  },

  shimPeerConnection: function() {
    if (typeof window !== 'object' || !(window.RTCPeerConnection ||
        window.mozRTCPeerConnection)) {
      return; // probably media.peerconnection.enabled=false in about:config
    }
    // The RTCPeerConnection object.
    if (!window.RTCPeerConnection) {
      window.RTCPeerConnection = function(pcConfig, pcConstraints) {
        if (browserDetails.version < 38) {
          // .urls is not supported in FF < 38.
          // create RTCIceServers with a single url.
          if (pcConfig && pcConfig.iceServers) {
            var newIceServers = [];
            for (var i = 0; i < pcConfig.iceServers.length; i++) {
              var server = pcConfig.iceServers[i];
              if (server.hasOwnProperty('urls')) {
                for (var j = 0; j < server.urls.length; j++) {
                  var newServer = {
                    url: server.urls[j]
                  };
                  if (server.urls[j].indexOf('turn') === 0) {
                    newServer.username = server.username;
                    newServer.credential = server.credential;
                  }
                  newIceServers.push(newServer);
                }
              } else {
                newIceServers.push(pcConfig.iceServers[i]);
              }
            }
            pcConfig.iceServers = newIceServers;
          }
        }
        return new mozRTCPeerConnection(pcConfig, pcConstraints);
      };
      window.RTCPeerConnection.prototype = mozRTCPeerConnection.prototype;

      // wrap static methods. Currently just generateCertificate.
      if (mozRTCPeerConnection.generateCertificate) {
        Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
          get: function() {
            return mozRTCPeerConnection.generateCertificate;
          }
        });
      }

      window.RTCSessionDescription = mozRTCSessionDescription;
      window.RTCIceCandidate = mozRTCIceCandidate;
    }

    // shim away need for obsolete RTCIceCandidate/RTCSessionDescription.
    ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
        .forEach(function(method) {
          var nativeMethod = RTCPeerConnection.prototype[method];
          RTCPeerConnection.prototype[method] = function() {
            arguments[0] = new ((method === 'addIceCandidate') ?
                RTCIceCandidate : RTCSessionDescription)(arguments[0]);
            return nativeMethod.apply(this, arguments);
          };
        });

    // support for addIceCandidate(null or undefined)
    var nativeAddIceCandidate =
        RTCPeerConnection.prototype.addIceCandidate;
    RTCPeerConnection.prototype.addIceCandidate = function() {
      if (!arguments[0]) {
        if (arguments[1]) {
          arguments[1].apply(null);
        }
        return Promise.resolve();
      }
      return nativeAddIceCandidate.apply(this, arguments);
    };

    // shim getStats with maplike support
    var makeMapStats = function(stats) {
      var map = new Map();
      Object.keys(stats).forEach(function(key) {
        map.set(key, stats[key]);
        map[key] = stats[key];
      });
      return map;
    };

    var modernStatsTypes = {
      inboundrtp: 'inbound-rtp',
      outboundrtp: 'outbound-rtp',
      candidatepair: 'candidate-pair',
      localcandidate: 'local-candidate',
      remotecandidate: 'remote-candidate'
    };

    var nativeGetStats = RTCPeerConnection.prototype.getStats;
    RTCPeerConnection.prototype.getStats = function(selector, onSucc, onErr) {
      return nativeGetStats.apply(this, [selector || null])
        .then(function(stats) {
          if (browserDetails.version < 48) {
            stats = makeMapStats(stats);
          }
          if (browserDetails.version < 53 && !onSucc) {
            // Shim only promise getStats with spec-hyphens in type names
            // Leave callback version alone; misc old uses of forEach before Map
            try {
              stats.forEach(function(stat) {
                stat.type = modernStatsTypes[stat.type] || stat.type;
              });
            } catch (e) {
              if (e.name !== 'TypeError') {
                throw e;
              }
              // Avoid TypeError: "type" is read-only, in old versions. 34-43ish
              stats.forEach(function(stat, i) {
                stats.set(i, Object.assign({}, stat, {
                  type: modernStatsTypes[stat.type] || stat.type
                }));
              });
            }
          }
          return stats;
        })
        .then(onSucc, onErr);
    };
  }
};

// Expose public methods.
module.exports = {
  shimOnTrack: firefoxShim.shimOnTrack,
  shimSourceObject: firefoxShim.shimSourceObject,
  shimPeerConnection: firefoxShim.shimPeerConnection,
  shimGetUserMedia: require('./getusermedia')
};

},{"../utils":33,"./getusermedia":31}],31:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var logging = require('../utils').log;
var browserDetails = require('../utils').browserDetails;

// Expose public methods.
module.exports = function() {
  var shimError_ = function(e) {
    return {
      name: {
        InternalError: 'NotReadableError',
        NotSupportedError: 'TypeError',
        PermissionDeniedError: 'NotAllowedError',
        SecurityError: 'NotAllowedError'
      }[e.name] || e.name,
      message: {
        'The operation is insecure.': 'The request is not allowed by the ' +
        'user agent or the platform in the current context.'
      }[e.message] || e.message,
      constraint: e.constraint,
      toString: function() {
        return this.name + (this.message && ': ') + this.message;
      }
    };
  };

  // getUserMedia constraints shim.
  var getUserMedia_ = function(constraints, onSuccess, onError) {
    var constraintsToFF37_ = function(c) {
      if (typeof c !== 'object' || c.require) {
        return c;
      }
      var require = [];
      Object.keys(c).forEach(function(key) {
        if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
          return;
        }
        var r = c[key] = (typeof c[key] === 'object') ?
            c[key] : {ideal: c[key]};
        if (r.min !== undefined ||
            r.max !== undefined || r.exact !== undefined) {
          require.push(key);
        }
        if (r.exact !== undefined) {
          if (typeof r.exact === 'number') {
            r. min = r.max = r.exact;
          } else {
            c[key] = r.exact;
          }
          delete r.exact;
        }
        if (r.ideal !== undefined) {
          c.advanced = c.advanced || [];
          var oc = {};
          if (typeof r.ideal === 'number') {
            oc[key] = {min: r.ideal, max: r.ideal};
          } else {
            oc[key] = r.ideal;
          }
          c.advanced.push(oc);
          delete r.ideal;
          if (!Object.keys(r).length) {
            delete c[key];
          }
        }
      });
      if (require.length) {
        c.require = require;
      }
      return c;
    };
    constraints = JSON.parse(JSON.stringify(constraints));
    if (browserDetails.version < 38) {
      logging('spec: ' + JSON.stringify(constraints));
      if (constraints.audio) {
        constraints.audio = constraintsToFF37_(constraints.audio);
      }
      if (constraints.video) {
        constraints.video = constraintsToFF37_(constraints.video);
      }
      logging('ff37: ' + JSON.stringify(constraints));
    }
    return navigator.mozGetUserMedia(constraints, onSuccess, function(e) {
      onError(shimError_(e));
    });
  };

  // Returns the result of getUserMedia as a Promise.
  var getUserMediaPromise_ = function(constraints) {
    return new Promise(function(resolve, reject) {
      getUserMedia_(constraints, resolve, reject);
    });
  };

  // Shim for mediaDevices on older versions.
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {getUserMedia: getUserMediaPromise_,
      addEventListener: function() { },
      removeEventListener: function() { }
    };
  }
  navigator.mediaDevices.enumerateDevices =
      navigator.mediaDevices.enumerateDevices || function() {
        return new Promise(function(resolve) {
          var infos = [
            {kind: 'audioinput', deviceId: 'default', label: '', groupId: ''},
            {kind: 'videoinput', deviceId: 'default', label: '', groupId: ''}
          ];
          resolve(infos);
        });
      };

  if (browserDetails.version < 41) {
    // Work around http://bugzil.la/1169665
    var orgEnumerateDevices =
        navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = function() {
      return orgEnumerateDevices().then(undefined, function(e) {
        if (e.name === 'NotFoundError') {
          return [];
        }
        throw e;
      });
    };
  }
  if (browserDetails.version < 49) {
    var origGetUserMedia = navigator.mediaDevices.getUserMedia.
        bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(c) {
      return origGetUserMedia(c).then(function(stream) {
        // Work around https://bugzil.la/802326
        if (c.audio && !stream.getAudioTracks().length ||
            c.video && !stream.getVideoTracks().length) {
          stream.getTracks().forEach(function(track) {
            track.stop();
          });
          throw new DOMException('The object can not be found here.',
                                 'NotFoundError');
        }
        return stream;
      }, function(e) {
        return Promise.reject(shimError_(e));
      });
    };
  }
  navigator.getUserMedia = function(constraints, onSuccess, onError) {
    if (browserDetails.version < 44) {
      return getUserMedia_(constraints, onSuccess, onError);
    }
    // Replace Firefox 44+'s deprecation warning with unprefixed version.
    console.warn('navigator.getUserMedia has been replaced by ' +
                 'navigator.mediaDevices.getUserMedia');
    navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
  };
};

},{"../utils":33}],32:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';
var safariShim = {
  // TODO: DrAlex, should be here, double check against LayoutTests

  // TODO: once the back-end for the mac port is done, add.
  // TODO: check for webkitGTK+
  // shimPeerConnection: function() { },

  shimAddStream: function() {
    if (typeof window === 'object' && window.RTCPeerConnection &&
        !('addStream' in window.RTCPeerConnection.prototype)) {
      RTCPeerConnection.prototype.addStream = function(stream) {
        var self = this;
        stream.getTracks().forEach(function(track) {
          self.addTrack(track, stream);
        });
      };
    }
  },
  shimOnAddStream: function() {
    if (typeof window === 'object' && window.RTCPeerConnection &&
        !('onaddstream' in window.RTCPeerConnection.prototype)) {
      Object.defineProperty(window.RTCPeerConnection.prototype, 'onaddstream', {
        get: function() {
          return this._onaddstream;
        },
        set: function(f) {
          if (this._onaddstream) {
            this.removeEventListener('addstream', this._onaddstream);
            this.removeEventListener('track', this._onaddstreampoly);
          }
          this.addEventListener('addstream', this._onaddstream = f);
          this.addEventListener('track', this._onaddstreampoly = function(e) {
            var stream = e.streams[0];
            if (!this._streams) {
              this._streams = [];
            }
            if (this._streams.indexOf(stream) >= 0) {
              return;
            }
            this._streams.push(stream);
            var event = new Event('addstream');
            event.stream = e.streams[0];
            this.dispatchEvent(event);
          }.bind(this));
        }
      });
    }
  },
  shimCallbacksAPI: function() {
    if (typeof window !== 'object' || !window.RTCPeerConnection) {
      return;
    }
    var prototype = RTCPeerConnection.prototype;
    var createOffer = prototype.createOffer;
    var createAnswer = prototype.createAnswer;
    var setLocalDescription = prototype.setLocalDescription;
    var setRemoteDescription = prototype.setRemoteDescription;
    var addIceCandidate = prototype.addIceCandidate;

    prototype.createOffer = function(successCallback, failureCallback) {
      var options = (arguments.length >= 2) ? arguments[2] : arguments[0];
      var promise = createOffer.apply(this, [options]);
      if (!failureCallback) {
        return promise;
      }
      promise.then(successCallback, failureCallback);
      return Promise.resolve();
    };

    prototype.createAnswer = function(successCallback, failureCallback) {
      var options = (arguments.length >= 2) ? arguments[2] : arguments[0];
      var promise = createAnswer.apply(this, [options]);
      if (!failureCallback) {
        return promise;
      }
      promise.then(successCallback, failureCallback);
      return Promise.resolve();
    };

    var withCallback = function(description, successCallback, failureCallback) {
      var promise = setLocalDescription.apply(this, [description]);
      if (!failureCallback) {
        return promise;
      }
      promise.then(successCallback, failureCallback);
      return Promise.resolve();
    };
    prototype.setLocalDescription = withCallback;

    withCallback = function(description, successCallback, failureCallback) {
      var promise = setRemoteDescription.apply(this, [description]);
      if (!failureCallback) {
        return promise;
      }
      promise.then(successCallback, failureCallback);
      return Promise.resolve();
    };
    prototype.setRemoteDescription = withCallback;

    withCallback = function(candidate, successCallback, failureCallback) {
      var promise = addIceCandidate.apply(this, [candidate]);
      if (!failureCallback) {
        return promise;
      }
      promise.then(successCallback, failureCallback);
      return Promise.resolve();
    };
    prototype.addIceCandidate = withCallback;
  },
  shimGetUserMedia: function() {
    if (!navigator.getUserMedia) {
      if (navigator.webkitGetUserMedia) {
        navigator.getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
      } else if (navigator.mediaDevices &&
          navigator.mediaDevices.getUserMedia) {
        navigator.getUserMedia = function(constraints, cb, errcb) {
          navigator.mediaDevices.getUserMedia(constraints)
          .then(cb, errcb);
        }.bind(navigator);
      }
    }
  }
};

// Expose public methods.
module.exports = {
  shimCallbacksAPI: safariShim.shimCallbacksAPI,
  shimAddStream: safariShim.shimAddStream,
  shimOnAddStream: safariShim.shimOnAddStream,
  shimGetUserMedia: safariShim.shimGetUserMedia
  // TODO
  // shimPeerConnection: safariShim.shimPeerConnection
};

},{}],33:[function(require,module,exports){
/*
 *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

var logDisabled_ = true;

// Utility methods.
var utils = {
  disableLog: function(bool) {
    if (typeof bool !== 'boolean') {
      return new Error('Argument type: ' + typeof bool +
          '. Please use a boolean.');
    }
    logDisabled_ = bool;
    return (bool) ? 'adapter.js logging disabled' :
        'adapter.js logging enabled';
  },

  log: function() {
    if (typeof window === 'object') {
      if (logDisabled_) {
        return;
      }
      if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log.apply(console, arguments);
      }
    }
  },

  /**
   * Extract browser version out of the provided user agent string.
   *
   * @param {!string} uastring userAgent string.
   * @param {!string} expr Regular expression used as match criteria.
   * @param {!number} pos position in the version string to be returned.
   * @return {!number} browser version.
   */
  extractVersion: function(uastring, expr, pos) {
    var match = uastring.match(expr);
    return match && match.length >= pos && parseInt(match[pos], 10);
  },

  /**
   * Browser detector.
   *
   * @return {object} result containing browser and version
   *     properties.
   */
  detectBrowser: function() {
    // Returned result object.
    var result = {};
    result.browser = null;
    result.version = null;

    // Fail early if it's not a browser
    if (typeof window === 'undefined' || !window.navigator) {
      result.browser = 'Not a browser.';
      return result;
    }

    // Firefox.
    if (navigator.mozGetUserMedia) {
      result.browser = 'firefox';
      result.version = this.extractVersion(navigator.userAgent,
          /Firefox\/(\d+)\./, 1);
    } else if (navigator.webkitGetUserMedia) {
      // Chrome, Chromium, Webview, Opera, all use the chrome shim for now
      if (window.webkitRTCPeerConnection) {
        result.browser = 'chrome';
        result.version = this.extractVersion(navigator.userAgent,
          /Chrom(e|ium)\/(\d+)\./, 2);
      } else { // Safari (in an unpublished version) or unknown webkit-based.
        if (navigator.userAgent.match(/Version\/(\d+).(\d+)/)) {
          result.browser = 'safari';
          result.version = this.extractVersion(navigator.userAgent,
            /AppleWebKit\/(\d+)\./, 1);
        } else { // unknown webkit-based browser.
          result.browser = 'Unsupported webkit-based browser ' +
              'with GUM support but no WebRTC support.';
          return result;
        }
      }
    } else if (navigator.mediaDevices &&
        navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) { // Edge.
      result.browser = 'edge';
      result.version = this.extractVersion(navigator.userAgent,
          /Edge\/(\d+).(\d+)$/, 2);
    } else if (navigator.mediaDevices &&
        navigator.userAgent.match(/AppleWebKit\/(\d+)\./)) {
        // Safari, with webkitGetUserMedia removed.
      result.browser = 'safari';
      result.version = this.extractVersion(navigator.userAgent,
          /AppleWebKit\/(\d+)\./, 1);
    } else { // Default fallthrough: not supported.
      result.browser = 'Not a supported browser.';
      return result;
    }

    return result;
  },

  // shimCreateObjectURL must be called before shimSourceObject to avoid loop.

  shimCreateObjectURL: function() { 
 if(true)return;
    if (!(typeof window === 'object' && window.HTMLMediaElement &&
          'srcObject' in window.HTMLMediaElement.prototype)) {
      // Only shim CreateObjectURL using srcObject if srcObject exists.
      return undefined;
    }

    var nativeCreateObjectURL = URL.createObjectURL.bind(URL);
    var nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    var streams = new Map(), newId = 0;

    URL.createObjectURL = function(stream) {
      if ('getTracks' in stream) {
        var url = 'polyblob:' + (++newId);
        streams.set(url, stream);
        console.log('URL.createObjectURL(stream) is deprecated! ' +
                    'Use elem.srcObject = stream instead!');
        return url;
      }
      return nativeCreateObjectURL(stream);
    };
    URL.revokeObjectURL = function(url) {
      nativeRevokeObjectURL(url);
      streams.delete(url);
    };

    var dsc = Object.getOwnPropertyDescriptor(window.HTMLMediaElement.prototype,
                                              'src');
    Object.defineProperty(window.HTMLMediaElement.prototype, 'src', {
      get: function() {
        return dsc.get.apply(this);
      },
      set: function(url) {
        this.srcObject = streams.get(url) || null;
        return dsc.set.apply(this, [url]);
      }
    });

    var nativeSetAttribute = HTMLMediaElement.prototype.setAttribute;
    HTMLMediaElement.prototype.setAttribute = function() {
      if (arguments.length === 2 &&
          ('' + arguments[0]).toLowerCase() === 'src') {
        this.srcObject = streams.get(arguments[1]) || null;
      }
      return nativeSetAttribute.apply(this, arguments);
    };
  }
};

// Export.
module.exports = {
  log: utils.log,
  disableLog: utils.disableLog,
  browserDetails: utils.detectBrowser(),
  extractVersion: utils.extractVersion,
  shimCreateObjectURL: utils.shimCreateObjectURL,
  detectBrowser: utils.detectBrowser.bind(utils)
};

},{}],34:[function(require,module,exports){
module.exports={
  "name": "plivowebsdk",
  "title": "plivowebsdk",
  "version": "2.0.13",
  "description": "Plivo WebRTC sdk for use in chrome/firefox ",
  "main": "./lib/index.js",
  "directories": {
    "example": "example"
  },
  "scripts": {
    "build": "node_modules/gulp/bin/gulp.js build"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/gigster-eng/PlivoWebSDK.git"
  },
  "author": "",
  "license": "ISC",
  "bugs": {
    "url": "https://github.com/gigster-eng/PlivoWebSDK/issues"
  },
  "homepage": "https://github.com/gigster-eng/PlivoWebSDK#readme",
  "dependencies": {
    "uuid": "^2.0.3",
    "debug": "^2.6.3",
    "sdp-transform": "^2.3.0",
    "webrtc-adapter": "^3.2.0"    
  },
  "devDependencies": {
    "browserify": "^9.0.3",
    "cheerio": "^0.18.0",
    "del": "^2.0.2",
    "disc": "^1.3.2",
    "eslint": "^2.12.0",
    "gulp": "^3.9.0",
    "gulp-copy": "0.0.2",
    "gulp-express": "^0.3.5",
    "gulp-insert": "^0.5.0",
    "gulp-istanbul": "^0.10.3",
    "gulp-newer": "^1.0.0",
    "gulp-rename": "^1.2.2",
    "gulp-replace": "^0.5.4",
    "gulp-uglify": "^1.4.2",
    "gulp-util": "^3.0.7",
    "jsdoc": "https://github.com/jsdoc3/jsdoc.git#e2fd9e75de9617aadfc3120331f020b2d66cff86",
    "jshint": "^2.6.3",
    "jshint-stylish": "^1.0.0",
    "mkdirp": "^0.5.1",
    "opener": "^1.4.2",
    "promptly": "^0.2.0",
    "release-tool": "^0.2.2",
    "run-sequence": "^1.2.2",
    "sinon": "^1.15.3",
    "stream-from-promise": "^0.1.0",
    "through2": "^2.0.0",
    "vinyl-source-stream": "^1.1.0",
    "gulp-footer" : "^1.0.5"
  }
}

},{}],35:[function(require,module,exports){
var pkg = require('../package.json');

var C = {
  USER_AGENT: pkg.title + ' ' + pkg.version,

  // SIP scheme
  SIP:  'sip',
  SIPS: 'sips',

  // End and Failure causes
  causes: {
    // Generic error causes
    CONNECTION_ERROR:         'Connection Error',
    REQUEST_TIMEOUT:          'Request Timeout',
    SIP_FAILURE_CODE:         'SIP Failure Code',
    INTERNAL_ERROR:           'Internal Error',

    // SIP error causes
    BUSY:                     'Busy',
    REJECTED:                 'Rejected',
    REDIRECTED:               'Redirected',
    UNAVAILABLE:              'Unavailable',
    NOT_FOUND:                'Not Found',
    ADDRESS_INCOMPLETE:       'Address Incomplete',
    INCOMPATIBLE_SDP:         'Incompatible SDP',
    MISSING_SDP:              'Missing SDP',
    AUTHENTICATION_ERROR:     'Authentication Error',

    // Session error causes
    BYE:                      'Terminated',
    WEBRTC_ERROR:             'WebRTC Error',
    CANCELED:                 'Canceled',
    NO_ANSWER:                'No Answer',
    EXPIRES:                  'Expires',
    NO_ACK:                   'No ACK',
    DIALOG_ERROR:             'Dialog Error',
    USER_DENIED_MEDIA_ACCESS: 'User Denied Media Access',
    BAD_MEDIA_DESCRIPTION:    'Bad Media Description',
    RTP_TIMEOUT:              'RTP Timeout'
  },

  SIP_ERROR_CAUSES: {
    REDIRECTED: [300,301,302,305,380],
    BUSY: [486,600],
    REJECTED: [403,603],
    NOT_FOUND: [404,604],
    UNAVAILABLE: [480,410,408,430],
    ADDRESS_INCOMPLETE: [484, 424],
    INCOMPATIBLE_SDP: [488,606],
    AUTHENTICATION_ERROR:[401,407]
  },

  // SIP Methods
  ACK:        'ACK',
  BYE:        'BYE',
  CANCEL:     'CANCEL',
  INFO:       'INFO',
  INVITE:     'INVITE',
  MESSAGE:    'MESSAGE',
  NOTIFY:     'NOTIFY',
  OPTIONS:    'OPTIONS',
  REGISTER:   'REGISTER',
  REFER:      'REFER',
  UPDATE:     'UPDATE',
  SUBSCRIBE:  'SUBSCRIBE',

  /* SIP Response Reasons
   * DOC: http://www.iana.org/assignments/sip-parameters
   * Copied from https://github.com/versatica/OverSIP/blob/master/lib/oversip/sip/constants.rb#L7
   */
  REASON_PHRASE: {
    100: 'Trying',
    180: 'Ringing',
    181: 'Call Is Being Forwarded',
    182: 'Queued',
    183: 'Session Progress',
    199: 'Early Dialog Terminated',  // draft-ietf-sipcore-199
    200: 'OK',
    202: 'Accepted',  // RFC 3265
    204: 'No Notification',  //RFC 5839
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Moved Temporarily',
    305: 'Use Proxy',
    380: 'Alternative Service',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    410: 'Gone',
    412: 'Conditional Request Failed',  // RFC 3903
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Unsupported URI Scheme',
    417: 'Unknown Resource-Priority',  // RFC 4412
    420: 'Bad Extension',
    421: 'Extension Required',
    422: 'Session Interval Too Small',  // RFC 4028
    423: 'Interval Too Brief',
    424: 'Bad Location Information',  // RFC 6442
    428: 'Use Identity Header',  // RFC 4474
    429: 'Provide Referrer Identity',  // RFC 3892
    430: 'Flow Failed',  // RFC 5626
    433: 'Anonymity Disallowed',  // RFC 5079
    436: 'Bad Identity-Info',  // RFC 4474
    437: 'Unsupported Certificate',  // RFC 4744
    438: 'Invalid Identity Header',  // RFC 4744
    439: 'First Hop Lacks Outbound Support',  // RFC 5626
    440: 'Max-Breadth Exceeded',  // RFC 5393
    469: 'Bad Info Package',  // draft-ietf-sipcore-info-events
    470: 'Consent Needed',  // RFC 5360
    478: 'Unresolvable Destination',  // Custom code copied from Kamailio.
    480: 'Temporarily Unavailable',
    481: 'Call/Transaction Does Not Exist',
    482: 'Loop Detected',
    483: 'Too Many Hops',
    484: 'Address Incomplete',
    485: 'Ambiguous',
    486: 'Busy Here',
    487: 'Request Terminated',
    488: 'Not Acceptable Here',
    489: 'Bad Event',  // RFC 3265
    491: 'Request Pending',
    493: 'Undecipherable',
    494: 'Security Agreement Required',  // RFC 3329
    500: 'JsSIP Internal Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Server Time-out',
    505: 'Version Not Supported',
    513: 'Message Too Large',
    580: 'Precondition Failure',  // RFC 3312
    600: 'Busy Everywhere',
    603: 'Decline',
    604: 'Does Not Exist Anywhere',
    606: 'Not Acceptable'
  },

  ALLOWED_METHODS: 'INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO',
  ACCEPTED_BODY_TYPES: 'application/sdp, application/dtmf-relay',
  MAX_FORWARDS: 69,
  SESSION_EXPIRES: 90,
  MIN_SESSION_EXPIRES: 60
};


module.exports = C;

},{"../package.json":34}],36:[function(require,module,exports){
module.exports = Dialog;


var C = {
  // Dialog states
  STATUS_EARLY:       1,
  STATUS_CONFIRMED:   2
};

/**
 * Expose C object.
 */
Dialog.C = C;


/**
 * Dependencies.
 */
var debug = require('debug')('PlivoSIP:Dialog');
var SIPMessage = require('./SIPMessage');
var JsSIP_C = require('./Constants');
var Transactions = require('./Transactions');
var Dialog_RequestSender = require('./Dialog/RequestSender');


// RFC 3261 12.1
function Dialog(owner, message, type, state) {
  var contact;

  this.uac_pending_reply = false;
  this.uas_pending_reply = false;

  if(!message.hasHeader('contact')) {
    return {
      error: 'unable to create a Dialog without Contact header field'
    };
  }

  if(message instanceof SIPMessage.IncomingResponse) {
    state = (message.status_code < 200) ? C.STATUS_EARLY : C.STATUS_CONFIRMED;
  } else {
    // Create confirmed dialog if state is not defined
    state = state || C.STATUS_CONFIRMED;
  }

  contact = message.parseHeader('contact');

  // RFC 3261 12.1.1
  if(type === 'UAS') {
    this.id = {
      call_id: message.call_id,
      local_tag: message.to_tag,
      remote_tag: message.from_tag,
      toString: function() {
        return this.call_id + this.local_tag + this.remote_tag;
      }
    };
    this.state = state;
    this.remote_seqnum = message.cseq;
    this.local_uri = message.parseHeader('to').uri;
    this.remote_uri = message.parseHeader('from').uri;
    this.remote_target = contact.uri;
    this.route_set = message.getHeaders('record-route');
  }
  // RFC 3261 12.1.2
  else if(type === 'UAC') {
    this.id = {
      call_id: message.call_id,
      local_tag: message.from_tag,
      remote_tag: message.to_tag,
      toString: function() {
        return this.call_id + this.local_tag + this.remote_tag;
      }
    };
    this.state = state;
    this.local_seqnum = message.cseq;
    this.local_uri = message.parseHeader('from').uri;
    this.remote_uri = message.parseHeader('to').uri;
    this.remote_target = contact.uri;
    this.route_set = message.getHeaders('record-route').reverse();
  }

  this.owner = owner;
  owner.ua.dialogs[this.id.toString()] = this;
  debug('new ' + type + ' dialog created with status ' + (this.state === C.STATUS_EARLY ? 'EARLY': 'CONFIRMED'));
}


Dialog.prototype = {
  update: function(message, type) {
    this.state = C.STATUS_CONFIRMED;

    debug('dialog '+ this.id.toString() +'  changed to CONFIRMED state');

    if(type === 'UAC') {
      // RFC 3261 13.2.2.4
      this.route_set = message.getHeaders('record-route').reverse();
    }
  },

  terminate: function() {
    debug('dialog ' + this.id.toString() + ' deleted');
    delete this.owner.ua.dialogs[this.id.toString()];
  },

  // RFC 3261 12.2.1.1
  createRequest: function(method, extraHeaders, body) {
    var cseq, request;
    extraHeaders = extraHeaders && extraHeaders.slice() || [];

    if(!this.local_seqnum) { this.local_seqnum = Math.floor(Math.random() * 10000); }

    cseq = (method === JsSIP_C.CANCEL || method === JsSIP_C.ACK) ? this.local_seqnum : this.local_seqnum += 1;

    request = new SIPMessage.OutgoingRequest(
      method,
      this.remote_target,
      this.owner.ua, {
        'cseq': cseq,
        'call_id': this.id.call_id,
        'from_uri': this.local_uri,
        'from_tag': this.id.local_tag,
        'to_uri': this.remote_uri,
        'to_tag': this.id.remote_tag,
        'route_set': this.route_set
      }, extraHeaders, body);

    request.dialog = this;

    return request;
  },

  // RFC 3261 12.2.2
  checkInDialogRequest: function(request) {
    var self = this;

    if(!this.remote_seqnum) {
      this.remote_seqnum = request.cseq;
    } else if(request.cseq < this.remote_seqnum) {
        //Do not try to reply to an ACK request.
        if (request.method !== JsSIP_C.ACK) {
          request.reply(500);
        }
        return false;
    } else if(request.cseq > this.remote_seqnum) {
      this.remote_seqnum = request.cseq;
    }

    // RFC3261 14.2 Modifying an Existing Session -UAS BEHAVIOR-
    if (request.method === JsSIP_C.INVITE || (request.method === JsSIP_C.UPDATE && request.body)) {
      if (this.uac_pending_reply === true) {
        request.reply(491);
      } else if (this.uas_pending_reply === true) {
        var retryAfter = (Math.random() * 10 | 0) + 1;
        request.reply(500, null, ['Retry-After:'+ retryAfter]);
        return false;
      } else {
        this.uas_pending_reply = true;
        request.server_transaction.on('stateChanged', function stateChanged(){
          if (this.state === Transactions.C.STATUS_ACCEPTED ||
              this.state === Transactions.C.STATUS_COMPLETED ||
              this.state === Transactions.C.STATUS_TERMINATED) {

            request.server_transaction.removeListener('stateChanged', stateChanged);
            self.uas_pending_reply = false;
          }
        });
      }

      // RFC3261 12.2.2 Replace the dialog`s remote target URI if the request is accepted
      if(request.hasHeader('contact')) {
        request.server_transaction.on('stateChanged', function(){
          if (this.state === Transactions.C.STATUS_ACCEPTED) {
            self.remote_target = request.parseHeader('contact').uri;
          }
        });
      }
    }
    else if (request.method === JsSIP_C.NOTIFY) {
      // RFC6665 3.2 Replace the dialog`s remote target URI if the request is accepted
      if(request.hasHeader('contact')) {
        request.server_transaction.on('stateChanged', function(){
          if (this.state === Transactions.C.STATUS_COMPLETED) {
            self.remote_target = request.parseHeader('contact').uri;
          }
        });
      }
    }

    return true;
  },

  sendRequest: function(applicant, method, options) {
    options = options || {};

    var
      extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [],
      body = options.body || null,
      request = this.createRequest(method, extraHeaders, body),
      request_sender = new Dialog_RequestSender(this, applicant, request);

      request_sender.send();

      // Return the instance of OutgoingRequest
      return request;
  },

  receiveRequest: function(request) {
    //Check in-dialog request
    if(!this.checkInDialogRequest(request)) {
      return;
    }

    this.owner.receiveRequest(request);
  }
};

},{"./Constants":35,"./Dialog/RequestSender":37,"./SIPMessage":52,"./Transactions":55,"debug":11}],37:[function(require,module,exports){
module.exports = DialogRequestSender;

/**
 * Dependencies.
 */
var JsSIP_C = require('../Constants');
var Transactions = require('../Transactions');
var RTCSession = require('../RTCSession');
var RequestSender = require('../RequestSender');


function DialogRequestSender(dialog, applicant, request) {

  this.dialog = dialog;
  this.applicant = applicant;
  this.request = request;

  // RFC3261 14.1 Modifying an Existing Session. UAC Behavior.
  this.reattempt = false;
  this.reattemptTimer = null;
}


DialogRequestSender.prototype = {
  send: function() {
    var
      self = this,
      request_sender = new RequestSender(this, this.dialog.owner.ua);

    request_sender.send();

    // RFC3261 14.2 Modifying an Existing Session -UAC BEHAVIOR-
    if ((this.request.method === JsSIP_C.INVITE || (this.request.method === JsSIP_C.UPDATE && this.request.body)) &&
        request_sender.clientTransaction.state !== Transactions.C.STATUS_TERMINATED) {
      this.dialog.uac_pending_reply = true;
      request_sender.clientTransaction.on('stateChanged', function stateChanged(){
        if (this.state === Transactions.C.STATUS_ACCEPTED ||
            this.state === Transactions.C.STATUS_COMPLETED ||
            this.state === Transactions.C.STATUS_TERMINATED) {

          request_sender.clientTransaction.removeListener('stateChanged', stateChanged);
          self.dialog.uac_pending_reply = false;
        }
      });
    }
  },

  onRequestTimeout: function() {
    this.applicant.onRequestTimeout();
  },

  onTransportError: function() {
    this.applicant.onTransportError();
  },

  receiveResponse: function(response) {
    var self = this;

    // RFC3261 12.2.1.2 408 or 481 is received for a request within a dialog.
    if (response.status_code === 408 || response.status_code === 481) {
      this.applicant.onDialogError(response);
    } else if (response.method === JsSIP_C.INVITE && response.status_code === 491) {
      if (this.reattempt) {
        this.applicant.receiveResponse(response);
      } else {
        this.request.cseq.value = this.dialog.local_seqnum += 1;
        this.reattemptTimer = setTimeout(function() {
          if (self.applicant.owner.status !== RTCSession.C.STATUS_TERMINATED) {
            self.reattempt = true;
            self.request_sender.send();
          }
        }, 1000);
      }
    } else {
      this.applicant.receiveResponse(response);
    }
  }
};

},{"../Constants":35,"../RTCSession":45,"../RequestSender":51,"../Transactions":55}],38:[function(require,module,exports){
module.exports = DigestAuthentication;


/**
 * Dependencies.
 */
var debug = require('debug')('PlivoSIP:DigestAuthentication');
var debugerror = require('debug')('PlivoSIP:ERROR:DigestAuthentication');
debugerror.log = console.warn.bind(console);
var Utils = require('./Utils');


function DigestAuthentication(credentials) {
  this.credentials = credentials;
  this.cnonce = null;
  this.nc = 0;
  this.ncHex = '00000000';
  this.algorithm = null;
  this.realm = null;
  this.nonce = null;
  this.opaque = null;
  this.stale = null;
  this.qop = null;
  this.method = null;
  this.uri = null;
  this.ha1 = null;
  this.response = null;
}


DigestAuthentication.prototype.get = function(parameter) {
  switch (parameter) {
    case 'realm':
      return this.realm;

    case 'ha1':
      return this.ha1;

    default:
      debugerror('get() | cannot get "%s" parameter', parameter);
      return undefined;
  }
};


/**
* Performs Digest authentication given a SIP request and the challenge
* received in a response to that request.
* Returns true if auth was successfully generated, false otherwise.
*/
DigestAuthentication.prototype.authenticate = function(request, challenge) {
  var ha2, hex;

  this.algorithm = challenge.algorithm;
  this.realm = challenge.realm;
  this.nonce = challenge.nonce;
  this.opaque = challenge.opaque;
  this.stale = challenge.stale;

  if (this.algorithm) {
    if (this.algorithm !== 'MD5') {
      debugerror('authenticate() | challenge with Digest algorithm different than "MD5", authentication aborted');
      return false;
    }
  } else {
    this.algorithm = 'MD5';
  }

  if (!this.nonce) {
    debugerror('authenticate() | challenge without Digest nonce, authentication aborted');
    return false;
  }

  if (!this.realm) {
    debugerror('authenticate() | challenge without Digest realm, authentication aborted');
    return false;
  }

  // If no plain SIP password is provided.
  if (!this.credentials.password) {
    // If ha1 is not provided we cannot authenticate.
    if (!this.credentials.ha1) {
      debugerror('authenticate() | no plain SIP password nor ha1 provided, authentication aborted');
      return false;
    }

    // If the realm does not match the stored realm we cannot authenticate.
    if (this.credentials.realm !== this.realm) {
      debugerror('authenticate() | no plain SIP password, and stored `realm` does not match the given `realm`, cannot authenticate [stored:"%s", given:"%s"]', this.credentials.realm, this.realm);
      return false;
    }
  }

  // 'qop' can contain a list of values (Array). Let's choose just one.
  if (challenge.qop) {
    if (challenge.qop.indexOf('auth') > -1) {
      this.qop = 'auth';
    } else if (challenge.qop.indexOf('auth-int') > -1) {
      this.qop = 'auth-int';
    } else {
      // Otherwise 'qop' is present but does not contain 'auth' or 'auth-int', so abort here.
      debugerror('authenticate() | challenge without Digest qop different than "auth" or "auth-int", authentication aborted');
      return false;
    }
  } else {
    this.qop = null;
  }

  // Fill other attributes.

  this.method = request.method;
  this.uri = request.ruri;
  this.cnonce = Utils.createRandomToken(12);
  this.nc += 1;
  hex = Number(this.nc).toString(16);
  this.ncHex = '00000000'.substr(0, 8-hex.length) + hex;

  // nc-value = 8LHEX. Max value = 'FFFFFFFF'.
  if (this.nc === 4294967296) {
    this.nc = 1;
    this.ncHex = '00000001';
  }

  // Calculate the Digest "response" value.

  // If we have plain SIP password then regenerate ha1.
  if (this.credentials.password) {
    // HA1 = MD5(A1) = MD5(username:realm:password)
    this.ha1 = Utils.calculateMD5(this.credentials.username + ':' + this.realm + ':' + this.credentials.password);
    //
  // Otherwise reuse the stored ha1.
  } else {
    this.ha1 = this.credentials.ha1;
  }

  if (this.qop === 'auth') {
    // HA2 = MD5(A2) = MD5(method:digestURI)
    ha2 = Utils.calculateMD5(this.method + ':' + this.uri);
    // response = MD5(HA1:nonce:nonceCount:credentialsNonce:qop:HA2)
    this.response = Utils.calculateMD5(this.ha1 + ':' + this.nonce + ':' + this.ncHex + ':' + this.cnonce + ':auth:' + ha2);

  } else if (this.qop === 'auth-int') {
    // HA2 = MD5(A2) = MD5(method:digestURI:MD5(entityBody))
    ha2 = Utils.calculateMD5(this.method + ':' + this.uri + ':' + Utils.calculateMD5(this.body ? this.body : ''));
    // response = MD5(HA1:nonce:nonceCount:credentialsNonce:qop:HA2)
    this.response = Utils.calculateMD5(this.ha1 + ':' + this.nonce + ':' + this.ncHex + ':' + this.cnonce + ':auth-int:' + ha2);

  } else if (this.qop === null) {
    // HA2 = MD5(A2) = MD5(method:digestURI)
    ha2 = Utils.calculateMD5(this.method + ':' + this.uri);
    // response = MD5(HA1:nonce:HA2)
    this.response = Utils.calculateMD5(this.ha1 + ':' + this.nonce + ':' + ha2);
  }

  debug('authenticate() | response generated');

  return true;
};


/**
* Return the Proxy-Authorization or WWW-Authorization header value.
*/
DigestAuthentication.prototype.toString = function() {
  var auth_params = [];

  if (!this.response) {
    throw new Error('response field does not exist, cannot generate Authorization header');
  }

  auth_params.push('algorithm=' + this.algorithm);
  auth_params.push('username="' + this.credentials.username + '"');
  auth_params.push('realm="' + this.realm + '"');
  auth_params.push('nonce="' + this.nonce + '"');
  auth_params.push('uri="' + this.uri + '"');
  auth_params.push('response="' + this.response + '"');
  if (this.opaque) {
    auth_params.push('opaque="' + this.opaque + '"');
  }
  if (this.qop) {
    auth_params.push('qop=' + this.qop);
    auth_params.push('cnonce="' + this.cnonce + '"');
    auth_params.push('nc=' + this.ncHex);
  }

  return 'Digest ' + auth_params.join(', ');
};

},{"./Utils":59,"debug":11}],39:[function(require,module,exports){
/**
 * @namespace Exceptions
 * @memberOf JsSIP
 */
var Exceptions = {
  /**
   * Exception thrown when a valid parameter is given to the JsSIP.UA constructor.
   * @class ConfigurationError
   * @memberOf JsSIP.Exceptions
   */
  ConfigurationError: (function(){
    var exception = function(parameter, value) {
      this.code = 1;
      this.name = 'CONFIGURATION_ERROR';
      this.parameter = parameter;
      this.value = value;
      this.message = (!this.value)? 'Missing parameter: '+ this.parameter : 'Invalid value '+ JSON.stringify(this.value) +' for parameter "'+ this.parameter +'"';
    };
    exception.prototype = new Error();
    return exception;
  }()),

  InvalidStateError: (function(){
    var exception = function(status) {
      this.code = 2;
      this.name = 'INVALID_STATE_ERROR';
      this.status = status;
      this.message = 'Invalid status: '+ status;
    };
    exception.prototype = new Error();
    return exception;
  }()),

  NotSupportedError: (function(){
    var exception = function(message) {
      this.code = 3;
      this.name = 'NOT_SUPPORTED_ERROR';
      this.message = message;
    };
    exception.prototype = new Error();
    return exception;
  }()),

  NotReadyError: (function(){
    var exception = function(message) {
      this.code = 4;
      this.name = 'NOT_READY_ERROR';
      this.message = message;
    };
    exception.prototype = new Error();
    return exception;
  }())
};


module.exports = Exceptions;

},{}],40:[function(require,module,exports){
module.exports = (function(){
  /*
   * Generated by PEG.js 0.7.0.
   *
   * http://pegjs.majda.cz/
   */
  function quote(s) {
    /*
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
     * string literal except for the closing quote character, backslash,
     * carriage return, line separator, paragraph separator, and line feed.
     * Any character may appear in the form of an escape sequence.
     *
     * For portability, we also escape escape all control and non-ASCII
     * characters. Note that "\0" and "\v" escape sequences are not used
     * because JSHint does not like the first and IE the second.
     */
     return '"' + s
      .replace(/\\/g, '\\\\')  // backslash
      .replace(/"/g, '\\"')    // closing quote character
      .replace(/\x08/g, '\\b') // backspace
      .replace(/\t/g, '\\t')   // horizontal tab
      .replace(/\n/g, '\\n')   // line feed
      .replace(/\f/g, '\\f')   // form feed
      .replace(/\r/g, '\\r')   // carriage return
      .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
      + '"';
  }
  var result = {
    /*
     * Parses the input with a generated parser. If the parsing is successfull,
     * returns a value explicitly or implicitly specified by the grammar from
     * which the parser was generated (see |PEG.buildParser|). If the parsing is
     * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
     */
    parse: function(input, startRule) {
      var parseFunctions = {
        "CRLF": parse_CRLF,
        "DIGIT": parse_DIGIT,
        "ALPHA": parse_ALPHA,
        "HEXDIG": parse_HEXDIG,
        "WSP": parse_WSP,
        "OCTET": parse_OCTET,
        "DQUOTE": parse_DQUOTE,
        "SP": parse_SP,
        "HTAB": parse_HTAB,
        "alphanum": parse_alphanum,
        "reserved": parse_reserved,
        "unreserved": parse_unreserved,
        "mark": parse_mark,
        "escaped": parse_escaped,
        "LWS": parse_LWS,
        "SWS": parse_SWS,
        "HCOLON": parse_HCOLON,
        "TEXT_UTF8_TRIM": parse_TEXT_UTF8_TRIM,
        "TEXT_UTF8char": parse_TEXT_UTF8char,
        "UTF8_NONASCII": parse_UTF8_NONASCII,
        "UTF8_CONT": parse_UTF8_CONT,
        "LHEX": parse_LHEX,
        "token": parse_token,
        "token_nodot": parse_token_nodot,
        "separators": parse_separators,
        "word": parse_word,
        "STAR": parse_STAR,
        "SLASH": parse_SLASH,
        "EQUAL": parse_EQUAL,
        "LPAREN": parse_LPAREN,
        "RPAREN": parse_RPAREN,
        "RAQUOT": parse_RAQUOT,
        "LAQUOT": parse_LAQUOT,
        "COMMA": parse_COMMA,
        "SEMI": parse_SEMI,
        "COLON": parse_COLON,
        "LDQUOT": parse_LDQUOT,
        "RDQUOT": parse_RDQUOT,
        "comment": parse_comment,
        "ctext": parse_ctext,
        "quoted_string": parse_quoted_string,
        "quoted_string_clean": parse_quoted_string_clean,
        "qdtext": parse_qdtext,
        "quoted_pair": parse_quoted_pair,
        "SIP_URI_noparams": parse_SIP_URI_noparams,
        "SIP_URI": parse_SIP_URI,
        "uri_scheme": parse_uri_scheme,
        "uri_scheme_sips": parse_uri_scheme_sips,
        "uri_scheme_sip": parse_uri_scheme_sip,
        "userinfo": parse_userinfo,
        "user": parse_user,
        "user_unreserved": parse_user_unreserved,
        "password": parse_password,
        "hostport": parse_hostport,
        "host": parse_host,
        "hostname": parse_hostname,
        "domainlabel": parse_domainlabel,
        "toplabel": parse_toplabel,
        "IPv6reference": parse_IPv6reference,
        "IPv6address": parse_IPv6address,
        "h16": parse_h16,
        "ls32": parse_ls32,
        "IPv4address": parse_IPv4address,
        "dec_octet": parse_dec_octet,
        "port": parse_port,
        "uri_parameters": parse_uri_parameters,
        "uri_parameter": parse_uri_parameter,
        "transport_param": parse_transport_param,
        "user_param": parse_user_param,
        "method_param": parse_method_param,
        "ttl_param": parse_ttl_param,
        "maddr_param": parse_maddr_param,
        "lr_param": parse_lr_param,
        "other_param": parse_other_param,
        "pname": parse_pname,
        "pvalue": parse_pvalue,
        "paramchar": parse_paramchar,
        "param_unreserved": parse_param_unreserved,
        "headers": parse_headers,
        "header": parse_header,
        "hname": parse_hname,
        "hvalue": parse_hvalue,
        "hnv_unreserved": parse_hnv_unreserved,
        "Request_Response": parse_Request_Response,
        "Request_Line": parse_Request_Line,
        "Request_URI": parse_Request_URI,
        "absoluteURI": parse_absoluteURI,
        "hier_part": parse_hier_part,
        "net_path": parse_net_path,
        "abs_path": parse_abs_path,
        "opaque_part": parse_opaque_part,
        "uric": parse_uric,
        "uric_no_slash": parse_uric_no_slash,
        "path_segments": parse_path_segments,
        "segment": parse_segment,
        "param": parse_param,
        "pchar": parse_pchar,
        "scheme": parse_scheme,
        "authority": parse_authority,
        "srvr": parse_srvr,
        "reg_name": parse_reg_name,
        "query": parse_query,
        "SIP_Version": parse_SIP_Version,
        "INVITEm": parse_INVITEm,
        "ACKm": parse_ACKm,
        "OPTIONSm": parse_OPTIONSm,
        "BYEm": parse_BYEm,
        "CANCELm": parse_CANCELm,
        "REGISTERm": parse_REGISTERm,
        "SUBSCRIBEm": parse_SUBSCRIBEm,
        "NOTIFYm": parse_NOTIFYm,
        "REFERm": parse_REFERm,
        "Method": parse_Method,
        "Status_Line": parse_Status_Line,
        "Status_Code": parse_Status_Code,
        "extension_code": parse_extension_code,
        "Reason_Phrase": parse_Reason_Phrase,
        "Allow_Events": parse_Allow_Events,
        "Call_ID": parse_Call_ID,
        "Contact": parse_Contact,
        "contact_param": parse_contact_param,
        "name_addr": parse_name_addr,
        "display_name": parse_display_name,
        "contact_params": parse_contact_params,
        "c_p_q": parse_c_p_q,
        "c_p_expires": parse_c_p_expires,
        "delta_seconds": parse_delta_seconds,
        "qvalue": parse_qvalue,
        "generic_param": parse_generic_param,
        "gen_value": parse_gen_value,
        "Content_Disposition": parse_Content_Disposition,
        "disp_type": parse_disp_type,
        "disp_param": parse_disp_param,
        "handling_param": parse_handling_param,
        "Content_Encoding": parse_Content_Encoding,
        "Content_Length": parse_Content_Length,
        "Content_Type": parse_Content_Type,
        "media_type": parse_media_type,
        "m_type": parse_m_type,
        "discrete_type": parse_discrete_type,
        "composite_type": parse_composite_type,
        "extension_token": parse_extension_token,
        "x_token": parse_x_token,
        "m_subtype": parse_m_subtype,
        "m_parameter": parse_m_parameter,
        "m_value": parse_m_value,
        "CSeq": parse_CSeq,
        "CSeq_value": parse_CSeq_value,
        "Expires": parse_Expires,
        "Event": parse_Event,
        "event_type": parse_event_type,
        "From": parse_From,
        "from_param": parse_from_param,
        "tag_param": parse_tag_param,
        "Max_Forwards": parse_Max_Forwards,
        "Min_Expires": parse_Min_Expires,
        "Name_Addr_Header": parse_Name_Addr_Header,
        "Proxy_Authenticate": parse_Proxy_Authenticate,
        "challenge": parse_challenge,
        "other_challenge": parse_other_challenge,
        "auth_param": parse_auth_param,
        "digest_cln": parse_digest_cln,
        "realm": parse_realm,
        "realm_value": parse_realm_value,
        "domain": parse_domain,
        "URI": parse_URI,
        "nonce": parse_nonce,
        "nonce_value": parse_nonce_value,
        "opaque": parse_opaque,
        "stale": parse_stale,
        "algorithm": parse_algorithm,
        "qop_options": parse_qop_options,
        "qop_value": parse_qop_value,
        "Proxy_Require": parse_Proxy_Require,
        "Record_Route": parse_Record_Route,
        "rec_route": parse_rec_route,
        "Reason": parse_Reason,
        "reason_param": parse_reason_param,
        "reason_cause": parse_reason_cause,
        "Require": parse_Require,
        "Route": parse_Route,
        "route_param": parse_route_param,
        "Subscription_State": parse_Subscription_State,
        "substate_value": parse_substate_value,
        "subexp_params": parse_subexp_params,
        "event_reason_value": parse_event_reason_value,
        "Subject": parse_Subject,
        "Supported": parse_Supported,
        "To": parse_To,
        "to_param": parse_to_param,
        "Via": parse_Via,
        "via_param": parse_via_param,
        "via_params": parse_via_params,
        "via_ttl": parse_via_ttl,
        "via_maddr": parse_via_maddr,
        "via_received": parse_via_received,
        "via_branch": parse_via_branch,
        "response_port": parse_response_port,
        "sent_protocol": parse_sent_protocol,
        "protocol_name": parse_protocol_name,
        "transport": parse_transport,
        "sent_by": parse_sent_by,
        "via_host": parse_via_host,
        "via_port": parse_via_port,
        "ttl": parse_ttl,
        "WWW_Authenticate": parse_WWW_Authenticate,
        "Session_Expires": parse_Session_Expires,
        "s_e_expires": parse_s_e_expires,
        "s_e_params": parse_s_e_params,
        "s_e_refresher": parse_s_e_refresher,
        "extension_header": parse_extension_header,
        "header_value": parse_header_value,
        "message_body": parse_message_body,
        "uuid_URI": parse_uuid_URI,
        "uuid": parse_uuid,
        "hex4": parse_hex4,
        "hex8": parse_hex8,
        "hex12": parse_hex12,
        "Refer_To": parse_Refer_To,
        "Replaces": parse_Replaces,
        "call_id": parse_call_id,
        "replaces_param": parse_replaces_param,
        "to_tag": parse_to_tag,
        "from_tag": parse_from_tag,
        "early_flag": parse_early_flag
      };
      if (startRule !== undefined) {
        if (parseFunctions[startRule] === undefined) {
          throw new Error("Invalid rule name: " + quote(startRule) + ".");
        }
      } else {
        startRule = "CRLF";
      }
      var pos = 0;
      var reportFailures = 0;
      var rightmostFailuresPos = 0;
      var rightmostFailuresExpected = [];
      function padLeft(input, padding, length) {
        var result = input;
        var padLength = length - input.length;
        for (var i = 0; i < padLength; i++) {
          result = padding + result;
        }
        return result;
      }
      function escape(ch) {
        var charCode = ch.charCodeAt(0);
        var escapeChar;
        var length;
        if (charCode <= 0xFF) {
          escapeChar = 'x';
          length = 2;
        } else {
          escapeChar = 'u';
          length = 4;
        }
        return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
      }
      function matchFailed(failure) {
        if (pos < rightmostFailuresPos) {
          return;
        }
        if (pos > rightmostFailuresPos) {
          rightmostFailuresPos = pos;
          rightmostFailuresExpected = [];
        }
        rightmostFailuresExpected.push(failure);
      }
      function parse_CRLF() {
        var result0;
        if (input.substr(pos, 2) === "\r\n") {
          result0 = "\r\n";
          pos += 2;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\r\\n\"");
          }
        }
        return result0;
      }
      function parse_DIGIT() {
        var result0;
        if (/^[0-9]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[0-9]");
          }
        }
        return result0;
      }
      function parse_ALPHA() {
        var result0;
        if (/^[a-zA-Z]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[a-zA-Z]");
          }
        }
        return result0;
      }
      function parse_HEXDIG() {
        var result0;
        if (/^[0-9a-fA-F]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[0-9a-fA-F]");
          }
        }
        return result0;
      }
      function parse_WSP() {
        var result0;
        result0 = parse_SP();
        if (result0 === null) {
          result0 = parse_HTAB();
        }
        return result0;
      }
      function parse_OCTET() {
        var result0;
        if (/^[\0-\xFF]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[\\0-\\xFF]");
          }
        }
        return result0;
      }
      function parse_DQUOTE() {
        var result0;
        if (/^["]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[\"]");
          }
        }
        return result0;
      }
      function parse_SP() {
        var result0;
        if (input.charCodeAt(pos) === 32) {
          result0 = " ";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\" \"");
          }
        }
        return result0;
      }
      function parse_HTAB() {
        var result0;
        if (input.charCodeAt(pos) === 9) {
          result0 = "\t";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\t\"");
          }
        }
        return result0;
      }
      function parse_alphanum() {
        var result0;
        if (/^[a-zA-Z0-9]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[a-zA-Z0-9]");
          }
        }
        return result0;
      }
      function parse_reserved() {
        var result0;
        if (input.charCodeAt(pos) === 59) {
          result0 = ";";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\";\"");
          }
        }
        if (result0 === null) {
          if (input.charCodeAt(pos) === 47) {
            result0 = "/";
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"/\"");
            }
          }
          if (result0 === null) {
            if (input.charCodeAt(pos) === 63) {
              result0 = "?";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"?\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos) === 58) {
                result0 = ":";
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\":\"");
                }
              }
              if (result0 === null) {
                if (input.charCodeAt(pos) === 64) {
                  result0 = "@";
                  pos++;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"@\"");
                  }
                }
                if (result0 === null) {
                  if (input.charCodeAt(pos) === 38) {
                    result0 = "&";
                    pos++;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"&\"");
                    }
                  }
                  if (result0 === null) {
                    if (input.charCodeAt(pos) === 61) {
                      result0 = "=";
                      pos++;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"=\"");
                      }
                    }
                    if (result0 === null) {
                      if (input.charCodeAt(pos) === 43) {
                        result0 = "+";
                        pos++;
                      } else {
                        result0 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"+\"");
                        }
                      }
                      if (result0 === null) {
                        if (input.charCodeAt(pos) === 36) {
                          result0 = "$";
                          pos++;
                        } else {
                          result0 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"$\"");
                          }
                        }
                        if (result0 === null) {
                          if (input.charCodeAt(pos) === 44) {
                            result0 = ",";
                            pos++;
                          } else {
                            result0 = null;
                            if (reportFailures === 0) {
                              matchFailed("\",\"");
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_unreserved() {
        var result0;
        result0 = parse_alphanum();
        if (result0 === null) {
          result0 = parse_mark();
        }
        return result0;
      }
      function parse_mark() {
        var result0;
        if (input.charCodeAt(pos) === 45) {
          result0 = "-";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"-\"");
          }
        }
        if (result0 === null) {
          if (input.charCodeAt(pos) === 95) {
            result0 = "_";
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"_\"");
            }
          }
          if (result0 === null) {
            if (input.charCodeAt(pos) === 46) {
              result0 = ".";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\".\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos) === 33) {
                result0 = "!";
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"!\"");
                }
              }
              if (result0 === null) {
                if (input.charCodeAt(pos) === 126) {
                  result0 = "~";
                  pos++;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"~\"");
                  }
                }
                if (result0 === null) {
                  if (input.charCodeAt(pos) === 42) {
                    result0 = "*";
                    pos++;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"*\"");
                    }
                  }
                  if (result0 === null) {
                    if (input.charCodeAt(pos) === 39) {
                      result0 = "'";
                      pos++;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"'\"");
                      }
                    }
                    if (result0 === null) {
                      if (input.charCodeAt(pos) === 40) {
                        result0 = "(";
                        pos++;
                      } else {
                        result0 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"(\"");
                        }
                      }
                      if (result0 === null) {
                        if (input.charCodeAt(pos) === 41) {
                          result0 = ")";
                          pos++;
                        } else {
                          result0 = null;
                          if (reportFailures === 0) {
                            matchFailed("\")\"");
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_escaped() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 37) {
          result0 = "%";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"%\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_HEXDIG();
          if (result1 !== null) {
            result2 = parse_HEXDIG();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, escaped) {return escaped.join(''); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_LWS() {
        var result0, result1, result2;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        pos2 = pos;
        result0 = [];
        result1 = parse_WSP();
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_WSP();
        }
        if (result0 !== null) {
          result1 = parse_CRLF();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos2;
          }
        } else {
          result0 = null;
          pos = pos2;
        }
        result0 = result0 !== null ? result0 : "";
        if (result0 !== null) {
          result2 = parse_WSP();
          if (result2 !== null) {
            result1 = [];
            while (result2 !== null) {
              result1.push(result2);
              result2 = parse_WSP();
            }
          } else {
            result1 = null;
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return " "; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_SWS() {
        var result0;
        result0 = parse_LWS();
        result0 = result0 !== null ? result0 : "";
        return result0;
      }
      function parse_HCOLON() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = [];
        result1 = parse_SP();
        if (result1 === null) {
          result1 = parse_HTAB();
        }
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_SP();
          if (result1 === null) {
            result1 = parse_HTAB();
          }
        }
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 58) {
            result1 = ":";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\":\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_SWS();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return ':'; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_TEXT_UTF8_TRIM() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result1 = parse_TEXT_UTF8char();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_TEXT_UTF8char();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = [];
          result3 = parse_LWS();
          while (result3 !== null) {
            result2.push(result3);
            result3 = parse_LWS();
          }
          if (result2 !== null) {
            result3 = parse_TEXT_UTF8char();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = [];
            result3 = parse_LWS();
            while (result3 !== null) {
              result2.push(result3);
              result3 = parse_LWS();
            }
            if (result2 !== null) {
              result3 = parse_TEXT_UTF8char();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            return input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_TEXT_UTF8char() {
        var result0;
        if (/^[!-~]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[!-~]");
          }
        }
        if (result0 === null) {
          result0 = parse_UTF8_NONASCII();
        }
        return result0;
      }
      function parse_UTF8_NONASCII() {
        var result0;
        if (/^[\x80-\uFFFF]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[\\x80-\\uFFFF]");
          }
        }
        return result0;
      }
      function parse_UTF8_CONT() {
        var result0;
        if (/^[\x80-\xBF]/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[\\x80-\\xBF]");
          }
        }
        return result0;
      }
      function parse_LHEX() {
        var result0;
        result0 = parse_DIGIT();
        if (result0 === null) {
          if (/^[a-f]/.test(input.charAt(pos))) {
            result0 = input.charAt(pos);
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("[a-f]");
            }
          }
        }
        return result0;
      }
      function parse_token() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result1 = parse_alphanum();
        if (result1 === null) {
          if (input.charCodeAt(pos) === 45) {
            result1 = "-";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"-\"");
            }
          }
          if (result1 === null) {
            if (input.charCodeAt(pos) === 46) {
              result1 = ".";
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\".\"");
              }
            }
            if (result1 === null) {
              if (input.charCodeAt(pos) === 33) {
                result1 = "!";
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"!\"");
                }
              }
              if (result1 === null) {
                if (input.charCodeAt(pos) === 37) {
                  result1 = "%";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"%\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 42) {
                    result1 = "*";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"*\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 95) {
                      result1 = "_";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"_\"");
                      }
                    }
                    if (result1 === null) {
                      if (input.charCodeAt(pos) === 43) {
                        result1 = "+";
                        pos++;
                      } else {
                        result1 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"+\"");
                        }
                      }
                      if (result1 === null) {
                        if (input.charCodeAt(pos) === 96) {
                          result1 = "`";
                          pos++;
                        } else {
                          result1 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"`\"");
                          }
                        }
                        if (result1 === null) {
                          if (input.charCodeAt(pos) === 39) {
                            result1 = "'";
                            pos++;
                          } else {
                            result1 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"'\"");
                            }
                          }
                          if (result1 === null) {
                            if (input.charCodeAt(pos) === 126) {
                              result1 = "~";
                              pos++;
                            } else {
                              result1 = null;
                              if (reportFailures === 0) {
                                matchFailed("\"~\"");
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_alphanum();
            if (result1 === null) {
              if (input.charCodeAt(pos) === 45) {
                result1 = "-";
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"-\"");
                }
              }
              if (result1 === null) {
                if (input.charCodeAt(pos) === 46) {
                  result1 = ".";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\".\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 33) {
                    result1 = "!";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"!\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 37) {
                      result1 = "%";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"%\"");
                      }
                    }
                    if (result1 === null) {
                      if (input.charCodeAt(pos) === 42) {
                        result1 = "*";
                        pos++;
                      } else {
                        result1 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"*\"");
                        }
                      }
                      if (result1 === null) {
                        if (input.charCodeAt(pos) === 95) {
                          result1 = "_";
                          pos++;
                        } else {
                          result1 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"_\"");
                          }
                        }
                        if (result1 === null) {
                          if (input.charCodeAt(pos) === 43) {
                            result1 = "+";
                            pos++;
                          } else {
                            result1 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"+\"");
                            }
                          }
                          if (result1 === null) {
                            if (input.charCodeAt(pos) === 96) {
                              result1 = "`";
                              pos++;
                            } else {
                              result1 = null;
                              if (reportFailures === 0) {
                                matchFailed("\"`\"");
                              }
                            }
                            if (result1 === null) {
                              if (input.charCodeAt(pos) === 39) {
                                result1 = "'";
                                pos++;
                              } else {
                                result1 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\"'\"");
                                }
                              }
                              if (result1 === null) {
                                if (input.charCodeAt(pos) === 126) {
                                  result1 = "~";
                                  pos++;
                                } else {
                                  result1 = null;
                                  if (reportFailures === 0) {
                                    matchFailed("\"~\"");
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          return input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_token_nodot() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result1 = parse_alphanum();
        if (result1 === null) {
          if (input.charCodeAt(pos) === 45) {
            result1 = "-";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"-\"");
            }
          }
          if (result1 === null) {
            if (input.charCodeAt(pos) === 33) {
              result1 = "!";
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\"!\"");
              }
            }
            if (result1 === null) {
              if (input.charCodeAt(pos) === 37) {
                result1 = "%";
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"%\"");
                }
              }
              if (result1 === null) {
                if (input.charCodeAt(pos) === 42) {
                  result1 = "*";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"*\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 95) {
                    result1 = "_";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"_\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 43) {
                      result1 = "+";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"+\"");
                      }
                    }
                    if (result1 === null) {
                      if (input.charCodeAt(pos) === 96) {
                        result1 = "`";
                        pos++;
                      } else {
                        result1 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"`\"");
                        }
                      }
                      if (result1 === null) {
                        if (input.charCodeAt(pos) === 39) {
                          result1 = "'";
                          pos++;
                        } else {
                          result1 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"'\"");
                          }
                        }
                        if (result1 === null) {
                          if (input.charCodeAt(pos) === 126) {
                            result1 = "~";
                            pos++;
                          } else {
                            result1 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"~\"");
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_alphanum();
            if (result1 === null) {
              if (input.charCodeAt(pos) === 45) {
                result1 = "-";
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"-\"");
                }
              }
              if (result1 === null) {
                if (input.charCodeAt(pos) === 33) {
                  result1 = "!";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"!\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 37) {
                    result1 = "%";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"%\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 42) {
                      result1 = "*";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"*\"");
                      }
                    }
                    if (result1 === null) {
                      if (input.charCodeAt(pos) === 95) {
                        result1 = "_";
                        pos++;
                      } else {
                        result1 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"_\"");
                        }
                      }
                      if (result1 === null) {
                        if (input.charCodeAt(pos) === 43) {
                          result1 = "+";
                          pos++;
                        } else {
                          result1 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"+\"");
                          }
                        }
                        if (result1 === null) {
                          if (input.charCodeAt(pos) === 96) {
                            result1 = "`";
                            pos++;
                          } else {
                            result1 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"`\"");
                            }
                          }
                          if (result1 === null) {
                            if (input.charCodeAt(pos) === 39) {
                              result1 = "'";
                              pos++;
                            } else {
                              result1 = null;
                              if (reportFailures === 0) {
                                matchFailed("\"'\"");
                              }
                            }
                            if (result1 === null) {
                              if (input.charCodeAt(pos) === 126) {
                                result1 = "~";
                                pos++;
                              } else {
                                result1 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\"~\"");
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          return input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_separators() {
        var result0;
        if (input.charCodeAt(pos) === 40) {
          result0 = "(";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"(\"");
          }
        }
        if (result0 === null) {
          if (input.charCodeAt(pos) === 41) {
            result0 = ")";
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\")\"");
            }
          }
          if (result0 === null) {
            if (input.charCodeAt(pos) === 60) {
              result0 = "<";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"<\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos) === 62) {
                result0 = ">";
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\">\"");
                }
              }
              if (result0 === null) {
                if (input.charCodeAt(pos) === 64) {
                  result0 = "@";
                  pos++;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"@\"");
                  }
                }
                if (result0 === null) {
                  if (input.charCodeAt(pos) === 44) {
                    result0 = ",";
                    pos++;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\",\"");
                    }
                  }
                  if (result0 === null) {
                    if (input.charCodeAt(pos) === 59) {
                      result0 = ";";
                      pos++;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\";\"");
                      }
                    }
                    if (result0 === null) {
                      if (input.charCodeAt(pos) === 58) {
                        result0 = ":";
                        pos++;
                      } else {
                        result0 = null;
                        if (reportFailures === 0) {
                          matchFailed("\":\"");
                        }
                      }
                      if (result0 === null) {
                        if (input.charCodeAt(pos) === 92) {
                          result0 = "\\";
                          pos++;
                        } else {
                          result0 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"\\\\\"");
                          }
                        }
                        if (result0 === null) {
                          result0 = parse_DQUOTE();
                          if (result0 === null) {
                            if (input.charCodeAt(pos) === 47) {
                              result0 = "/";
                              pos++;
                            } else {
                              result0 = null;
                              if (reportFailures === 0) {
                                matchFailed("\"/\"");
                              }
                            }
                            if (result0 === null) {
                              if (input.charCodeAt(pos) === 91) {
                                result0 = "[";
                                pos++;
                              } else {
                                result0 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\"[\"");
                                }
                              }
                              if (result0 === null) {
                                if (input.charCodeAt(pos) === 93) {
                                  result0 = "]";
                                  pos++;
                                } else {
                                  result0 = null;
                                  if (reportFailures === 0) {
                                    matchFailed("\"]\"");
                                  }
                                }
                                if (result0 === null) {
                                  if (input.charCodeAt(pos) === 63) {
                                    result0 = "?";
                                    pos++;
                                  } else {
                                    result0 = null;
                                    if (reportFailures === 0) {
                                      matchFailed("\"?\"");
                                    }
                                  }
                                  if (result0 === null) {
                                    if (input.charCodeAt(pos) === 61) {
                                      result0 = "=";
                                      pos++;
                                    } else {
                                      result0 = null;
                                      if (reportFailures === 0) {
                                        matchFailed("\"=\"");
                                      }
                                    }
                                    if (result0 === null) {
                                      if (input.charCodeAt(pos) === 123) {
                                        result0 = "{";
                                        pos++;
                                      } else {
                                        result0 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\"{\"");
                                        }
                                      }
                                      if (result0 === null) {
                                        if (input.charCodeAt(pos) === 125) {
                                          result0 = "}";
                                          pos++;
                                        } else {
                                          result0 = null;
                                          if (reportFailures === 0) {
                                            matchFailed("\"}\"");
                                          }
                                        }
                                        if (result0 === null) {
                                          result0 = parse_SP();
                                          if (result0 === null) {
                                            result0 = parse_HTAB();
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_word() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result1 = parse_alphanum();
        if (result1 === null) {
          if (input.charCodeAt(pos) === 45) {
            result1 = "-";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"-\"");
            }
          }
          if (result1 === null) {
            if (input.charCodeAt(pos) === 46) {
              result1 = ".";
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\".\"");
              }
            }
            if (result1 === null) {
              if (input.charCodeAt(pos) === 33) {
                result1 = "!";
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"!\"");
                }
              }
              if (result1 === null) {
                if (input.charCodeAt(pos) === 37) {
                  result1 = "%";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"%\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 42) {
                    result1 = "*";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"*\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 95) {
                      result1 = "_";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"_\"");
                      }
                    }
                    if (result1 === null) {
                      if (input.charCodeAt(pos) === 43) {
                        result1 = "+";
                        pos++;
                      } else {
                        result1 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"+\"");
                        }
                      }
                      if (result1 === null) {
                        if (input.charCodeAt(pos) === 96) {
                          result1 = "`";
                          pos++;
                        } else {
                          result1 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"`\"");
                          }
                        }
                        if (result1 === null) {
                          if (input.charCodeAt(pos) === 39) {
                            result1 = "'";
                            pos++;
                          } else {
                            result1 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"'\"");
                            }
                          }
                          if (result1 === null) {
                            if (input.charCodeAt(pos) === 126) {
                              result1 = "~";
                              pos++;
                            } else {
                              result1 = null;
                              if (reportFailures === 0) {
                                matchFailed("\"~\"");
                              }
                            }
                            if (result1 === null) {
                              if (input.charCodeAt(pos) === 40) {
                                result1 = "(";
                                pos++;
                              } else {
                                result1 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\"(\"");
                                }
                              }
                              if (result1 === null) {
                                if (input.charCodeAt(pos) === 41) {
                                  result1 = ")";
                                  pos++;
                                } else {
                                  result1 = null;
                                  if (reportFailures === 0) {
                                    matchFailed("\")\"");
                                  }
                                }
                                if (result1 === null) {
                                  if (input.charCodeAt(pos) === 60) {
                                    result1 = "<";
                                    pos++;
                                  } else {
                                    result1 = null;
                                    if (reportFailures === 0) {
                                      matchFailed("\"<\"");
                                    }
                                  }
                                  if (result1 === null) {
                                    if (input.charCodeAt(pos) === 62) {
                                      result1 = ">";
                                      pos++;
                                    } else {
                                      result1 = null;
                                      if (reportFailures === 0) {
                                        matchFailed("\">\"");
                                      }
                                    }
                                    if (result1 === null) {
                                      if (input.charCodeAt(pos) === 58) {
                                        result1 = ":";
                                        pos++;
                                      } else {
                                        result1 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\":\"");
                                        }
                                      }
                                      if (result1 === null) {
                                        if (input.charCodeAt(pos) === 92) {
                                          result1 = "\\";
                                          pos++;
                                        } else {
                                          result1 = null;
                                          if (reportFailures === 0) {
                                            matchFailed("\"\\\\\"");
                                          }
                                        }
                                        if (result1 === null) {
                                          result1 = parse_DQUOTE();
                                          if (result1 === null) {
                                            if (input.charCodeAt(pos) === 47) {
                                              result1 = "/";
                                              pos++;
                                            } else {
                                              result1 = null;
                                              if (reportFailures === 0) {
                                                matchFailed("\"/\"");
                                              }
                                            }
                                            if (result1 === null) {
                                              if (input.charCodeAt(pos) === 91) {
                                                result1 = "[";
                                                pos++;
                                              } else {
                                                result1 = null;
                                                if (reportFailures === 0) {
                                                  matchFailed("\"[\"");
                                                }
                                              }
                                              if (result1 === null) {
                                                if (input.charCodeAt(pos) === 93) {
                                                  result1 = "]";
                                                  pos++;
                                                } else {
                                                  result1 = null;
                                                  if (reportFailures === 0) {
                                                    matchFailed("\"]\"");
                                                  }
                                                }
                                                if (result1 === null) {
                                                  if (input.charCodeAt(pos) === 63) {
                                                    result1 = "?";
                                                    pos++;
                                                  } else {
                                                    result1 = null;
                                                    if (reportFailures === 0) {
                                                      matchFailed("\"?\"");
                                                    }
                                                  }
                                                  if (result1 === null) {
                                                    if (input.charCodeAt(pos) === 123) {
                                                      result1 = "{";
                                                      pos++;
                                                    } else {
                                                      result1 = null;
                                                      if (reportFailures === 0) {
                                                        matchFailed("\"{\"");
                                                      }
                                                    }
                                                    if (result1 === null) {
                                                      if (input.charCodeAt(pos) === 125) {
                                                        result1 = "}";
                                                        pos++;
                                                      } else {
                                                        result1 = null;
                                                        if (reportFailures === 0) {
                                                          matchFailed("\"}\"");
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_alphanum();
            if (result1 === null) {
              if (input.charCodeAt(pos) === 45) {
                result1 = "-";
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"-\"");
                }
              }
              if (result1 === null) {
                if (input.charCodeAt(pos) === 46) {
                  result1 = ".";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\".\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 33) {
                    result1 = "!";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"!\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 37) {
                      result1 = "%";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"%\"");
                      }
                    }
                    if (result1 === null) {
                      if (input.charCodeAt(pos) === 42) {
                        result1 = "*";
                        pos++;
                      } else {
                        result1 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"*\"");
                        }
                      }
                      if (result1 === null) {
                        if (input.charCodeAt(pos) === 95) {
                          result1 = "_";
                          pos++;
                        } else {
                          result1 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"_\"");
                          }
                        }
                        if (result1 === null) {
                          if (input.charCodeAt(pos) === 43) {
                            result1 = "+";
                            pos++;
                          } else {
                            result1 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"+\"");
                            }
                          }
                          if (result1 === null) {
                            if (input.charCodeAt(pos) === 96) {
                              result1 = "`";
                              pos++;
                            } else {
                              result1 = null;
                              if (reportFailures === 0) {
                                matchFailed("\"`\"");
                              }
                            }
                            if (result1 === null) {
                              if (input.charCodeAt(pos) === 39) {
                                result1 = "'";
                                pos++;
                              } else {
                                result1 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\"'\"");
                                }
                              }
                              if (result1 === null) {
                                if (input.charCodeAt(pos) === 126) {
                                  result1 = "~";
                                  pos++;
                                } else {
                                  result1 = null;
                                  if (reportFailures === 0) {
                                    matchFailed("\"~\"");
                                  }
                                }
                                if (result1 === null) {
                                  if (input.charCodeAt(pos) === 40) {
                                    result1 = "(";
                                    pos++;
                                  } else {
                                    result1 = null;
                                    if (reportFailures === 0) {
                                      matchFailed("\"(\"");
                                    }
                                  }
                                  if (result1 === null) {
                                    if (input.charCodeAt(pos) === 41) {
                                      result1 = ")";
                                      pos++;
                                    } else {
                                      result1 = null;
                                      if (reportFailures === 0) {
                                        matchFailed("\")\"");
                                      }
                                    }
                                    if (result1 === null) {
                                      if (input.charCodeAt(pos) === 60) {
                                        result1 = "<";
                                        pos++;
                                      } else {
                                        result1 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\"<\"");
                                        }
                                      }
                                      if (result1 === null) {
                                        if (input.charCodeAt(pos) === 62) {
                                          result1 = ">";
                                          pos++;
                                        } else {
                                          result1 = null;
                                          if (reportFailures === 0) {
                                            matchFailed("\">\"");
                                          }
                                        }
                                        if (result1 === null) {
                                          if (input.charCodeAt(pos) === 58) {
                                            result1 = ":";
                                            pos++;
                                          } else {
                                            result1 = null;
                                            if (reportFailures === 0) {
                                              matchFailed("\":\"");
                                            }
                                          }
                                          if (result1 === null) {
                                            if (input.charCodeAt(pos) === 92) {
                                              result1 = "\\";
                                              pos++;
                                            } else {
                                              result1 = null;
                                              if (reportFailures === 0) {
                                                matchFailed("\"\\\\\"");
                                              }
                                            }
                                            if (result1 === null) {
                                              result1 = parse_DQUOTE();
                                              if (result1 === null) {
                                                if (input.charCodeAt(pos) === 47) {
                                                  result1 = "/";
                                                  pos++;
                                                } else {
                                                  result1 = null;
                                                  if (reportFailures === 0) {
                                                    matchFailed("\"/\"");
                                                  }
                                                }
                                                if (result1 === null) {
                                                  if (input.charCodeAt(pos) === 91) {
                                                    result1 = "[";
                                                    pos++;
                                                  } else {
                                                    result1 = null;
                                                    if (reportFailures === 0) {
                                                      matchFailed("\"[\"");
                                                    }
                                                  }
                                                  if (result1 === null) {
                                                    if (input.charCodeAt(pos) === 93) {
                                                      result1 = "]";
                                                      pos++;
                                                    } else {
                                                      result1 = null;
                                                      if (reportFailures === 0) {
                                                        matchFailed("\"]\"");
                                                      }
                                                    }
                                                    if (result1 === null) {
                                                      if (input.charCodeAt(pos) === 63) {
                                                        result1 = "?";
                                                        pos++;
                                                      } else {
                                                        result1 = null;
                                                        if (reportFailures === 0) {
                                                          matchFailed("\"?\"");
                                                        }
                                                      }
                                                      if (result1 === null) {
                                                        if (input.charCodeAt(pos) === 123) {
                                                          result1 = "{";
                                                          pos++;
                                                        } else {
                                                          result1 = null;
                                                          if (reportFailures === 0) {
                                                            matchFailed("\"{\"");
                                                          }
                                                        }
                                                        if (result1 === null) {
                                                          if (input.charCodeAt(pos) === 125) {
                                                            result1 = "}";
                                                            pos++;
                                                          } else {
                                                            result1 = null;
                                                            if (reportFailures === 0) {
                                                              matchFailed("\"}\"");
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          return input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_STAR() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 42) {
            result1 = "*";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"*\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_SWS();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return "*"; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_SLASH() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 47) {
            result1 = "/";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"/\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_SWS();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return "/"; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_EQUAL() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 61) {
            result1 = "=";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"=\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_SWS();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return "="; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_LPAREN() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 40) {
            result1 = "(";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"(\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_SWS();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return "("; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_RPAREN() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 41) {
            result1 = ")";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\")\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_SWS();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return ")"; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_RAQUOT() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 62) {
          result0 = ">";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\">\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_SWS();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return ">"; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_LAQUOT() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 60) {
            result1 = "<";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"<\"");
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return "<"; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_COMMA() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 44) {
            result1 = ",";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\",\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_SWS();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return ","; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_SEMI() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 59) {
            result1 = ";";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\";\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_SWS();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return ";"; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_COLON() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 58) {
            result1 = ":";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\":\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_SWS();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return ":"; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_LDQUOT() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          result1 = parse_DQUOTE();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return "\""; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_RDQUOT() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_DQUOTE();
        if (result0 !== null) {
          result1 = parse_SWS();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {return "\""; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_comment() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_LPAREN();
        if (result0 !== null) {
          result1 = [];
          result2 = parse_ctext();
          if (result2 === null) {
            result2 = parse_quoted_pair();
            if (result2 === null) {
              result2 = parse_comment();
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            result2 = parse_ctext();
            if (result2 === null) {
              result2 = parse_quoted_pair();
              if (result2 === null) {
                result2 = parse_comment();
              }
            }
          }
          if (result1 !== null) {
            result2 = parse_RPAREN();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_ctext() {
        var result0;
        if (/^[!-']/.test(input.charAt(pos))) {
          result0 = input.charAt(pos);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("[!-']");
          }
        }
        if (result0 === null) {
          if (/^[*-[]/.test(input.charAt(pos))) {
            result0 = input.charAt(pos);
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("[*-[]");
            }
          }
          if (result0 === null) {
            if (/^[\]-~]/.test(input.charAt(pos))) {
              result0 = input.charAt(pos);
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("[\\]-~]");
              }
            }
            if (result0 === null) {
              result0 = parse_UTF8_NONASCII();
              if (result0 === null) {
                result0 = parse_LWS();
              }
            }
          }
        }
        return result0;
      }
      function parse_quoted_string() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          result1 = parse_DQUOTE();
          if (result1 !== null) {
            result2 = [];
            result3 = parse_qdtext();
            if (result3 === null) {
              result3 = parse_quoted_pair();
            }
            while (result3 !== null) {
              result2.push(result3);
              result3 = parse_qdtext();
              if (result3 === null) {
                result3 = parse_quoted_pair();
              }
            }
            if (result2 !== null) {
              result3 = parse_DQUOTE();
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          return input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_quoted_string_clean() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SWS();
        if (result0 !== null) {
          result1 = parse_DQUOTE();
          if (result1 !== null) {
            result2 = [];
            result3 = parse_qdtext();
            if (result3 === null) {
              result3 = parse_quoted_pair();
            }
            while (result3 !== null) {
              result2.push(result3);
              result3 = parse_qdtext();
              if (result3 === null) {
                result3 = parse_quoted_pair();
              }
            }
            if (result2 !== null) {
              result3 = parse_DQUOTE();
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                                return input.substring(pos-1, offset+1); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_qdtext() {
        var result0;
        result0 = parse_LWS();
        if (result0 === null) {
          if (input.charCodeAt(pos) === 33) {
            result0 = "!";
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"!\"");
            }
          }
          if (result0 === null) {
            if (/^[#-[]/.test(input.charAt(pos))) {
              result0 = input.charAt(pos);
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("[#-[]");
              }
            }
            if (result0 === null) {
              if (/^[\]-~]/.test(input.charAt(pos))) {
                result0 = input.charAt(pos);
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("[\\]-~]");
                }
              }
              if (result0 === null) {
                result0 = parse_UTF8_NONASCII();
              }
            }
          }
        }
        return result0;
      }
      function parse_quoted_pair() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        if (input.charCodeAt(pos) === 92) {
          result0 = "\\";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\\\\"");
          }
        }
        if (result0 !== null) {
          if (/^[\0-\t]/.test(input.charAt(pos))) {
            result1 = input.charAt(pos);
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[\\0-\\t]");
            }
          }
          if (result1 === null) {
            if (/^[\x0B-\f]/.test(input.charAt(pos))) {
              result1 = input.charAt(pos);
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[\\x0B-\\f]");
              }
            }
            if (result1 === null) {
              if (/^[\x0E-]/.test(input.charAt(pos))) {
                result1 = input.charAt(pos);
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("[\\x0E-]");
                }
              }
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_SIP_URI_noparams() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_uri_scheme();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 58) {
            result1 = ":";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\":\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_userinfo();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result3 = parse_hostport();
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            try {
                                data.uri = new URI(data.scheme, data.user, data.host, data.port);
                                delete data.scheme;
                                delete data.user;
                                delete data.host;
                                delete data.host_type;
                                delete data.port;
                              } catch(e) {
                                data = -1;
                              }})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_SIP_URI() {
        var result0, result1, result2, result3, result4, result5;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_uri_scheme();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 58) {
            result1 = ":";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\":\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_userinfo();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result3 = parse_hostport();
              if (result3 !== null) {
                result4 = parse_uri_parameters();
                if (result4 !== null) {
                  result5 = parse_headers();
                  result5 = result5 !== null ? result5 : "";
                  if (result5 !== null) {
                    result0 = [result0, result1, result2, result3, result4, result5];
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            var header;
                            try {
                                data.uri = new URI(data.scheme, data.user, data.host, data.port, data.uri_params, data.uri_headers);
                                delete data.scheme;
                                delete data.user;
                                delete data.host;
                                delete data.host_type;
                                delete data.port;
                                delete data.uri_params;
                                if (startRule === 'SIP_URI') { data = data.uri;}
                              } catch(e) {
                                data = -1;
                              }})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_uri_scheme() {
        var result0;
        result0 = parse_uri_scheme_sips();
        if (result0 === null) {
          result0 = parse_uri_scheme_sip();
        }
        return result0;
      }
      function parse_uri_scheme_sips() {
        var result0;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 4).toLowerCase() === "sips") {
          result0 = input.substr(pos, 4);
          pos += 4;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"sips\"");
          }
        }
        if (result0 !== null) {
          result0 = (function(offset, scheme) {
                            data.scheme = scheme.toLowerCase(); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_uri_scheme_sip() {
        var result0;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 3).toLowerCase() === "sip") {
          result0 = input.substr(pos, 3);
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"sip\"");
          }
        }
        if (result0 !== null) {
          result0 = (function(offset, scheme) {
                            data.scheme = scheme.toLowerCase(); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_userinfo() {
        var result0, result1, result2;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_user();
        if (result0 !== null) {
          pos2 = pos;
          if (input.charCodeAt(pos) === 58) {
            result1 = ":";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\":\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_password();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos2;
            }
          } else {
            result1 = null;
            pos = pos2;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 64) {
              result2 = "@";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"@\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            data.user = decodeURIComponent(input.substring(pos-1, offset));})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_user() {
        var result0, result1;
        result1 = parse_unreserved();
        if (result1 === null) {
          result1 = parse_escaped();
          if (result1 === null) {
            result1 = parse_user_unreserved();
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_unreserved();
            if (result1 === null) {
              result1 = parse_escaped();
              if (result1 === null) {
                result1 = parse_user_unreserved();
              }
            }
          }
        } else {
          result0 = null;
        }
        return result0;
      }
      function parse_user_unreserved() {
        var result0;
        if (input.charCodeAt(pos) === 38) {
          result0 = "&";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"&\"");
          }
        }
        if (result0 === null) {
          if (input.charCodeAt(pos) === 61) {
            result0 = "=";
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"=\"");
            }
          }
          if (result0 === null) {
            if (input.charCodeAt(pos) === 43) {
              result0 = "+";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"+\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos) === 36) {
                result0 = "$";
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"$\"");
                }
              }
              if (result0 === null) {
                if (input.charCodeAt(pos) === 44) {
                  result0 = ",";
                  pos++;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\",\"");
                  }
                }
                if (result0 === null) {
                  if (input.charCodeAt(pos) === 59) {
                    result0 = ";";
                    pos++;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\";\"");
                    }
                  }
                  if (result0 === null) {
                    if (input.charCodeAt(pos) === 63) {
                      result0 = "?";
                      pos++;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"?\"");
                      }
                    }
                    if (result0 === null) {
                      if (input.charCodeAt(pos) === 47) {
                        result0 = "/";
                        pos++;
                      } else {
                        result0 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"/\"");
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_password() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result0 = [];
        result1 = parse_unreserved();
        if (result1 === null) {
          result1 = parse_escaped();
          if (result1 === null) {
            if (input.charCodeAt(pos) === 38) {
              result1 = "&";
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\"&\"");
              }
            }
            if (result1 === null) {
              if (input.charCodeAt(pos) === 61) {
                result1 = "=";
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"=\"");
                }
              }
              if (result1 === null) {
                if (input.charCodeAt(pos) === 43) {
                  result1 = "+";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"+\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 36) {
                    result1 = "$";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"$\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 44) {
                      result1 = ",";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\",\"");
                      }
                    }
                  }
                }
              }
            }
          }
        }
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_unreserved();
          if (result1 === null) {
            result1 = parse_escaped();
            if (result1 === null) {
              if (input.charCodeAt(pos) === 38) {
                result1 = "&";
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"&\"");
                }
              }
              if (result1 === null) {
                if (input.charCodeAt(pos) === 61) {
                  result1 = "=";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"=\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 43) {
                    result1 = "+";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"+\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 36) {
                      result1 = "$";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"$\"");
                      }
                    }
                    if (result1 === null) {
                      if (input.charCodeAt(pos) === 44) {
                        result1 = ",";
                        pos++;
                      } else {
                        result1 = null;
                        if (reportFailures === 0) {
                          matchFailed("\",\"");
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            data.password = input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_hostport() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_host();
        if (result0 !== null) {
          pos1 = pos;
          if (input.charCodeAt(pos) === 58) {
            result1 = ":";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\":\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_port();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos1;
            }
          } else {
            result1 = null;
            pos = pos1;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_host() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_hostname();
        if (result0 === null) {
          result0 = parse_IPv4address();
          if (result0 === null) {
            result0 = parse_IPv6reference();
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            data.host = input.substring(pos, offset).toLowerCase();
                            return data.host; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_hostname() {
        var result0, result1, result2;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = [];
        pos2 = pos;
        result1 = parse_domainlabel();
        if (result1 !== null) {
          if (input.charCodeAt(pos) === 46) {
            result2 = ".";
            pos++;
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("\".\"");
            }
          }
          if (result2 !== null) {
            result1 = [result1, result2];
          } else {
            result1 = null;
            pos = pos2;
          }
        } else {
          result1 = null;
          pos = pos2;
        }
        while (result1 !== null) {
          result0.push(result1);
          pos2 = pos;
          result1 = parse_domainlabel();
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 46) {
              result2 = ".";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\".\"");
              }
            }
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos2;
            }
          } else {
            result1 = null;
            pos = pos2;
          }
        }
        if (result0 !== null) {
          result1 = parse_toplabel();
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 46) {
              result2 = ".";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\".\"");
              }
            }
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          data.host_type = 'domain';
                          return input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_domainlabel() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_alphanum();
        if (result0 !== null) {
          result1 = [];
          result2 = parse_alphanum();
          if (result2 === null) {
            if (input.charCodeAt(pos) === 45) {
              result2 = "-";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"-\"");
              }
            }
            if (result2 === null) {
              if (input.charCodeAt(pos) === 95) {
                result2 = "_";
                pos++;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"_\"");
                }
              }
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            result2 = parse_alphanum();
            if (result2 === null) {
              if (input.charCodeAt(pos) === 45) {
                result2 = "-";
                pos++;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"-\"");
                }
              }
              if (result2 === null) {
                if (input.charCodeAt(pos) === 95) {
                  result2 = "_";
                  pos++;
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"_\"");
                  }
                }
              }
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_toplabel() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_ALPHA();
        if (result0 !== null) {
          result1 = [];
          result2 = parse_alphanum();
          if (result2 === null) {
            if (input.charCodeAt(pos) === 45) {
              result2 = "-";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"-\"");
              }
            }
            if (result2 === null) {
              if (input.charCodeAt(pos) === 95) {
                result2 = "_";
                pos++;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"_\"");
                }
              }
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            result2 = parse_alphanum();
            if (result2 === null) {
              if (input.charCodeAt(pos) === 45) {
                result2 = "-";
                pos++;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"-\"");
                }
              }
              if (result2 === null) {
                if (input.charCodeAt(pos) === 95) {
                  result2 = "_";
                  pos++;
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"_\"");
                  }
                }
              }
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_IPv6reference() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 91) {
          result0 = "[";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"[\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_IPv6address();
          if (result1 !== null) {
            if (input.charCodeAt(pos) === 93) {
              result2 = "]";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"]\"");
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            data.host_type = 'IPv6';
                            return input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_IPv6address() {
        var result0, result1, result2, result3, result4, result5, result6, result7, result8, result9, result10, result11, result12;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_h16();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 58) {
            result1 = ":";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\":\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_h16();
            if (result2 !== null) {
              if (input.charCodeAt(pos) === 58) {
                result3 = ":";
                pos++;
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("\":\"");
                }
              }
              if (result3 !== null) {
                result4 = parse_h16();
                if (result4 !== null) {
                  if (input.charCodeAt(pos) === 58) {
                    result5 = ":";
                    pos++;
                  } else {
                    result5 = null;
                    if (reportFailures === 0) {
                      matchFailed("\":\"");
                    }
                  }
                  if (result5 !== null) {
                    result6 = parse_h16();
                    if (result6 !== null) {
                      if (input.charCodeAt(pos) === 58) {
                        result7 = ":";
                        pos++;
                      } else {
                        result7 = null;
                        if (reportFailures === 0) {
                          matchFailed("\":\"");
                        }
                      }
                      if (result7 !== null) {
                        result8 = parse_h16();
                        if (result8 !== null) {
                          if (input.charCodeAt(pos) === 58) {
                            result9 = ":";
                            pos++;
                          } else {
                            result9 = null;
                            if (reportFailures === 0) {
                              matchFailed("\":\"");
                            }
                          }
                          if (result9 !== null) {
                            result10 = parse_h16();
                            if (result10 !== null) {
                              if (input.charCodeAt(pos) === 58) {
                                result11 = ":";
                                pos++;
                              } else {
                                result11 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\":\"");
                                }
                              }
                              if (result11 !== null) {
                                result12 = parse_ls32();
                                if (result12 !== null) {
                                  result0 = [result0, result1, result2, result3, result4, result5, result6, result7, result8, result9, result10, result11, result12];
                                } else {
                                  result0 = null;
                                  pos = pos1;
                                }
                              } else {
                                result0 = null;
                                pos = pos1;
                              }
                            } else {
                              result0 = null;
                              pos = pos1;
                            }
                          } else {
                            result0 = null;
                            pos = pos1;
                          }
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 === null) {
          pos1 = pos;
          if (input.substr(pos, 2) === "::") {
            result0 = "::";
            pos += 2;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"::\"");
            }
          }
          if (result0 !== null) {
            result1 = parse_h16();
            if (result1 !== null) {
              if (input.charCodeAt(pos) === 58) {
                result2 = ":";
                pos++;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\":\"");
                }
              }
              if (result2 !== null) {
                result3 = parse_h16();
                if (result3 !== null) {
                  if (input.charCodeAt(pos) === 58) {
                    result4 = ":";
                    pos++;
                  } else {
                    result4 = null;
                    if (reportFailures === 0) {
                      matchFailed("\":\"");
                    }
                  }
                  if (result4 !== null) {
                    result5 = parse_h16();
                    if (result5 !== null) {
                      if (input.charCodeAt(pos) === 58) {
                        result6 = ":";
                        pos++;
                      } else {
                        result6 = null;
                        if (reportFailures === 0) {
                          matchFailed("\":\"");
                        }
                      }
                      if (result6 !== null) {
                        result7 = parse_h16();
                        if (result7 !== null) {
                          if (input.charCodeAt(pos) === 58) {
                            result8 = ":";
                            pos++;
                          } else {
                            result8 = null;
                            if (reportFailures === 0) {
                              matchFailed("\":\"");
                            }
                          }
                          if (result8 !== null) {
                            result9 = parse_h16();
                            if (result9 !== null) {
                              if (input.charCodeAt(pos) === 58) {
                                result10 = ":";
                                pos++;
                              } else {
                                result10 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\":\"");
                                }
                              }
                              if (result10 !== null) {
                                result11 = parse_ls32();
                                if (result11 !== null) {
                                  result0 = [result0, result1, result2, result3, result4, result5, result6, result7, result8, result9, result10, result11];
                                } else {
                                  result0 = null;
                                  pos = pos1;
                                }
                              } else {
                                result0 = null;
                                pos = pos1;
                              }
                            } else {
                              result0 = null;
                              pos = pos1;
                            }
                          } else {
                            result0 = null;
                            pos = pos1;
                          }
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 === null) {
            pos1 = pos;
            if (input.substr(pos, 2) === "::") {
              result0 = "::";
              pos += 2;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"::\"");
              }
            }
            if (result0 !== null) {
              result1 = parse_h16();
              if (result1 !== null) {
                if (input.charCodeAt(pos) === 58) {
                  result2 = ":";
                  pos++;
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("\":\"");
                  }
                }
                if (result2 !== null) {
                  result3 = parse_h16();
                  if (result3 !== null) {
                    if (input.charCodeAt(pos) === 58) {
                      result4 = ":";
                      pos++;
                    } else {
                      result4 = null;
                      if (reportFailures === 0) {
                        matchFailed("\":\"");
                      }
                    }
                    if (result4 !== null) {
                      result5 = parse_h16();
                      if (result5 !== null) {
                        if (input.charCodeAt(pos) === 58) {
                          result6 = ":";
                          pos++;
                        } else {
                          result6 = null;
                          if (reportFailures === 0) {
                            matchFailed("\":\"");
                          }
                        }
                        if (result6 !== null) {
                          result7 = parse_h16();
                          if (result7 !== null) {
                            if (input.charCodeAt(pos) === 58) {
                              result8 = ":";
                              pos++;
                            } else {
                              result8 = null;
                              if (reportFailures === 0) {
                                matchFailed("\":\"");
                              }
                            }
                            if (result8 !== null) {
                              result9 = parse_ls32();
                              if (result9 !== null) {
                                result0 = [result0, result1, result2, result3, result4, result5, result6, result7, result8, result9];
                              } else {
                                result0 = null;
                                pos = pos1;
                              }
                            } else {
                              result0 = null;
                              pos = pos1;
                            }
                          } else {
                            result0 = null;
                            pos = pos1;
                          }
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
            if (result0 === null) {
              pos1 = pos;
              if (input.substr(pos, 2) === "::") {
                result0 = "::";
                pos += 2;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"::\"");
                }
              }
              if (result0 !== null) {
                result1 = parse_h16();
                if (result1 !== null) {
                  if (input.charCodeAt(pos) === 58) {
                    result2 = ":";
                    pos++;
                  } else {
                    result2 = null;
                    if (reportFailures === 0) {
                      matchFailed("\":\"");
                    }
                  }
                  if (result2 !== null) {
                    result3 = parse_h16();
                    if (result3 !== null) {
                      if (input.charCodeAt(pos) === 58) {
                        result4 = ":";
                        pos++;
                      } else {
                        result4 = null;
                        if (reportFailures === 0) {
                          matchFailed("\":\"");
                        }
                      }
                      if (result4 !== null) {
                        result5 = parse_h16();
                        if (result5 !== null) {
                          if (input.charCodeAt(pos) === 58) {
                            result6 = ":";
                            pos++;
                          } else {
                            result6 = null;
                            if (reportFailures === 0) {
                              matchFailed("\":\"");
                            }
                          }
                          if (result6 !== null) {
                            result7 = parse_ls32();
                            if (result7 !== null) {
                              result0 = [result0, result1, result2, result3, result4, result5, result6, result7];
                            } else {
                              result0 = null;
                              pos = pos1;
                            }
                          } else {
                            result0 = null;
                            pos = pos1;
                          }
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
              if (result0 === null) {
                pos1 = pos;
                if (input.substr(pos, 2) === "::") {
                  result0 = "::";
                  pos += 2;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"::\"");
                  }
                }
                if (result0 !== null) {
                  result1 = parse_h16();
                  if (result1 !== null) {
                    if (input.charCodeAt(pos) === 58) {
                      result2 = ":";
                      pos++;
                    } else {
                      result2 = null;
                      if (reportFailures === 0) {
                        matchFailed("\":\"");
                      }
                    }
                    if (result2 !== null) {
                      result3 = parse_h16();
                      if (result3 !== null) {
                        if (input.charCodeAt(pos) === 58) {
                          result4 = ":";
                          pos++;
                        } else {
                          result4 = null;
                          if (reportFailures === 0) {
                            matchFailed("\":\"");
                          }
                        }
                        if (result4 !== null) {
                          result5 = parse_ls32();
                          if (result5 !== null) {
                            result0 = [result0, result1, result2, result3, result4, result5];
                          } else {
                            result0 = null;
                            pos = pos1;
                          }
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
                if (result0 === null) {
                  pos1 = pos;
                  if (input.substr(pos, 2) === "::") {
                    result0 = "::";
                    pos += 2;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"::\"");
                    }
                  }
                  if (result0 !== null) {
                    result1 = parse_h16();
                    if (result1 !== null) {
                      if (input.charCodeAt(pos) === 58) {
                        result2 = ":";
                        pos++;
                      } else {
                        result2 = null;
                        if (reportFailures === 0) {
                          matchFailed("\":\"");
                        }
                      }
                      if (result2 !== null) {
                        result3 = parse_ls32();
                        if (result3 !== null) {
                          result0 = [result0, result1, result2, result3];
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                  if (result0 === null) {
                    pos1 = pos;
                    if (input.substr(pos, 2) === "::") {
                      result0 = "::";
                      pos += 2;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"::\"");
                      }
                    }
                    if (result0 !== null) {
                      result1 = parse_ls32();
                      if (result1 !== null) {
                        result0 = [result0, result1];
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                    if (result0 === null) {
                      pos1 = pos;
                      if (input.substr(pos, 2) === "::") {
                        result0 = "::";
                        pos += 2;
                      } else {
                        result0 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"::\"");
                        }
                      }
                      if (result0 !== null) {
                        result1 = parse_h16();
                        if (result1 !== null) {
                          result0 = [result0, result1];
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                      if (result0 === null) {
                        pos1 = pos;
                        result0 = parse_h16();
                        if (result0 !== null) {
                          if (input.substr(pos, 2) === "::") {
                            result1 = "::";
                            pos += 2;
                          } else {
                            result1 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"::\"");
                            }
                          }
                          if (result1 !== null) {
                            result2 = parse_h16();
                            if (result2 !== null) {
                              if (input.charCodeAt(pos) === 58) {
                                result3 = ":";
                                pos++;
                              } else {
                                result3 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\":\"");
                                }
                              }
                              if (result3 !== null) {
                                result4 = parse_h16();
                                if (result4 !== null) {
                                  if (input.charCodeAt(pos) === 58) {
                                    result5 = ":";
                                    pos++;
                                  } else {
                                    result5 = null;
                                    if (reportFailures === 0) {
                                      matchFailed("\":\"");
                                    }
                                  }
                                  if (result5 !== null) {
                                    result6 = parse_h16();
                                    if (result6 !== null) {
                                      if (input.charCodeAt(pos) === 58) {
                                        result7 = ":";
                                        pos++;
                                      } else {
                                        result7 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\":\"");
                                        }
                                      }
                                      if (result7 !== null) {
                                        result8 = parse_h16();
                                        if (result8 !== null) {
                                          if (input.charCodeAt(pos) === 58) {
                                            result9 = ":";
                                            pos++;
                                          } else {
                                            result9 = null;
                                            if (reportFailures === 0) {
                                              matchFailed("\":\"");
                                            }
                                          }
                                          if (result9 !== null) {
                                            result10 = parse_ls32();
                                            if (result10 !== null) {
                                              result0 = [result0, result1, result2, result3, result4, result5, result6, result7, result8, result9, result10];
                                            } else {
                                              result0 = null;
                                              pos = pos1;
                                            }
                                          } else {
                                            result0 = null;
                                            pos = pos1;
                                          }
                                        } else {
                                          result0 = null;
                                          pos = pos1;
                                        }
                                      } else {
                                        result0 = null;
                                        pos = pos1;
                                      }
                                    } else {
                                      result0 = null;
                                      pos = pos1;
                                    }
                                  } else {
                                    result0 = null;
                                    pos = pos1;
                                  }
                                } else {
                                  result0 = null;
                                  pos = pos1;
                                }
                              } else {
                                result0 = null;
                                pos = pos1;
                              }
                            } else {
                              result0 = null;
                              pos = pos1;
                            }
                          } else {
                            result0 = null;
                            pos = pos1;
                          }
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                        if (result0 === null) {
                          pos1 = pos;
                          result0 = parse_h16();
                          if (result0 !== null) {
                            pos2 = pos;
                            if (input.charCodeAt(pos) === 58) {
                              result1 = ":";
                              pos++;
                            } else {
                              result1 = null;
                              if (reportFailures === 0) {
                                matchFailed("\":\"");
                              }
                            }
                            if (result1 !== null) {
                              result2 = parse_h16();
                              if (result2 !== null) {
                                result1 = [result1, result2];
                              } else {
                                result1 = null;
                                pos = pos2;
                              }
                            } else {
                              result1 = null;
                              pos = pos2;
                            }
                            result1 = result1 !== null ? result1 : "";
                            if (result1 !== null) {
                              if (input.substr(pos, 2) === "::") {
                                result2 = "::";
                                pos += 2;
                              } else {
                                result2 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\"::\"");
                                }
                              }
                              if (result2 !== null) {
                                result3 = parse_h16();
                                if (result3 !== null) {
                                  if (input.charCodeAt(pos) === 58) {
                                    result4 = ":";
                                    pos++;
                                  } else {
                                    result4 = null;
                                    if (reportFailures === 0) {
                                      matchFailed("\":\"");
                                    }
                                  }
                                  if (result4 !== null) {
                                    result5 = parse_h16();
                                    if (result5 !== null) {
                                      if (input.charCodeAt(pos) === 58) {
                                        result6 = ":";
                                        pos++;
                                      } else {
                                        result6 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\":\"");
                                        }
                                      }
                                      if (result6 !== null) {
                                        result7 = parse_h16();
                                        if (result7 !== null) {
                                          if (input.charCodeAt(pos) === 58) {
                                            result8 = ":";
                                            pos++;
                                          } else {
                                            result8 = null;
                                            if (reportFailures === 0) {
                                              matchFailed("\":\"");
                                            }
                                          }
                                          if (result8 !== null) {
                                            result9 = parse_ls32();
                                            if (result9 !== null) {
                                              result0 = [result0, result1, result2, result3, result4, result5, result6, result7, result8, result9];
                                            } else {
                                              result0 = null;
                                              pos = pos1;
                                            }
                                          } else {
                                            result0 = null;
                                            pos = pos1;
                                          }
                                        } else {
                                          result0 = null;
                                          pos = pos1;
                                        }
                                      } else {
                                        result0 = null;
                                        pos = pos1;
                                      }
                                    } else {
                                      result0 = null;
                                      pos = pos1;
                                    }
                                  } else {
                                    result0 = null;
                                    pos = pos1;
                                  }
                                } else {
                                  result0 = null;
                                  pos = pos1;
                                }
                              } else {
                                result0 = null;
                                pos = pos1;
                              }
                            } else {
                              result0 = null;
                              pos = pos1;
                            }
                          } else {
                            result0 = null;
                            pos = pos1;
                          }
                          if (result0 === null) {
                            pos1 = pos;
                            result0 = parse_h16();
                            if (result0 !== null) {
                              pos2 = pos;
                              if (input.charCodeAt(pos) === 58) {
                                result1 = ":";
                                pos++;
                              } else {
                                result1 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\":\"");
                                }
                              }
                              if (result1 !== null) {
                                result2 = parse_h16();
                                if (result2 !== null) {
                                  result1 = [result1, result2];
                                } else {
                                  result1 = null;
                                  pos = pos2;
                                }
                              } else {
                                result1 = null;
                                pos = pos2;
                              }
                              result1 = result1 !== null ? result1 : "";
                              if (result1 !== null) {
                                pos2 = pos;
                                if (input.charCodeAt(pos) === 58) {
                                  result2 = ":";
                                  pos++;
                                } else {
                                  result2 = null;
                                  if (reportFailures === 0) {
                                    matchFailed("\":\"");
                                  }
                                }
                                if (result2 !== null) {
                                  result3 = parse_h16();
                                  if (result3 !== null) {
                                    result2 = [result2, result3];
                                  } else {
                                    result2 = null;
                                    pos = pos2;
                                  }
                                } else {
                                  result2 = null;
                                  pos = pos2;
                                }
                                result2 = result2 !== null ? result2 : "";
                                if (result2 !== null) {
                                  if (input.substr(pos, 2) === "::") {
                                    result3 = "::";
                                    pos += 2;
                                  } else {
                                    result3 = null;
                                    if (reportFailures === 0) {
                                      matchFailed("\"::\"");
                                    }
                                  }
                                  if (result3 !== null) {
                                    result4 = parse_h16();
                                    if (result4 !== null) {
                                      if (input.charCodeAt(pos) === 58) {
                                        result5 = ":";
                                        pos++;
                                      } else {
                                        result5 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\":\"");
                                        }
                                      }
                                      if (result5 !== null) {
                                        result6 = parse_h16();
                                        if (result6 !== null) {
                                          if (input.charCodeAt(pos) === 58) {
                                            result7 = ":";
                                            pos++;
                                          } else {
                                            result7 = null;
                                            if (reportFailures === 0) {
                                              matchFailed("\":\"");
                                            }
                                          }
                                          if (result7 !== null) {
                                            result8 = parse_ls32();
                                            if (result8 !== null) {
                                              result0 = [result0, result1, result2, result3, result4, result5, result6, result7, result8];
                                            } else {
                                              result0 = null;
                                              pos = pos1;
                                            }
                                          } else {
                                            result0 = null;
                                            pos = pos1;
                                          }
                                        } else {
                                          result0 = null;
                                          pos = pos1;
                                        }
                                      } else {
                                        result0 = null;
                                        pos = pos1;
                                      }
                                    } else {
                                      result0 = null;
                                      pos = pos1;
                                    }
                                  } else {
                                    result0 = null;
                                    pos = pos1;
                                  }
                                } else {
                                  result0 = null;
                                  pos = pos1;
                                }
                              } else {
                                result0 = null;
                                pos = pos1;
                              }
                            } else {
                              result0 = null;
                              pos = pos1;
                            }
                            if (result0 === null) {
                              pos1 = pos;
                              result0 = parse_h16();
                              if (result0 !== null) {
                                pos2 = pos;
                                if (input.charCodeAt(pos) === 58) {
                                  result1 = ":";
                                  pos++;
                                } else {
                                  result1 = null;
                                  if (reportFailures === 0) {
                                    matchFailed("\":\"");
                                  }
                                }
                                if (result1 !== null) {
                                  result2 = parse_h16();
                                  if (result2 !== null) {
                                    result1 = [result1, result2];
                                  } else {
                                    result1 = null;
                                    pos = pos2;
                                  }
                                } else {
                                  result1 = null;
                                  pos = pos2;
                                }
                                result1 = result1 !== null ? result1 : "";
                                if (result1 !== null) {
                                  pos2 = pos;
                                  if (input.charCodeAt(pos) === 58) {
                                    result2 = ":";
                                    pos++;
                                  } else {
                                    result2 = null;
                                    if (reportFailures === 0) {
                                      matchFailed("\":\"");
                                    }
                                  }
                                  if (result2 !== null) {
                                    result3 = parse_h16();
                                    if (result3 !== null) {
                                      result2 = [result2, result3];
                                    } else {
                                      result2 = null;
                                      pos = pos2;
                                    }
                                  } else {
                                    result2 = null;
                                    pos = pos2;
                                  }
                                  result2 = result2 !== null ? result2 : "";
                                  if (result2 !== null) {
                                    pos2 = pos;
                                    if (input.charCodeAt(pos) === 58) {
                                      result3 = ":";
                                      pos++;
                                    } else {
                                      result3 = null;
                                      if (reportFailures === 0) {
                                        matchFailed("\":\"");
                                      }
                                    }
                                    if (result3 !== null) {
                                      result4 = parse_h16();
                                      if (result4 !== null) {
                                        result3 = [result3, result4];
                                      } else {
                                        result3 = null;
                                        pos = pos2;
                                      }
                                    } else {
                                      result3 = null;
                                      pos = pos2;
                                    }
                                    result3 = result3 !== null ? result3 : "";
                                    if (result3 !== null) {
                                      if (input.substr(pos, 2) === "::") {
                                        result4 = "::";
                                        pos += 2;
                                      } else {
                                        result4 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\"::\"");
                                        }
                                      }
                                      if (result4 !== null) {
                                        result5 = parse_h16();
                                        if (result5 !== null) {
                                          if (input.charCodeAt(pos) === 58) {
                                            result6 = ":";
                                            pos++;
                                          } else {
                                            result6 = null;
                                            if (reportFailures === 0) {
                                              matchFailed("\":\"");
                                            }
                                          }
                                          if (result6 !== null) {
                                            result7 = parse_ls32();
                                            if (result7 !== null) {
                                              result0 = [result0, result1, result2, result3, result4, result5, result6, result7];
                                            } else {
                                              result0 = null;
                                              pos = pos1;
                                            }
                                          } else {
                                            result0 = null;
                                            pos = pos1;
                                          }
                                        } else {
                                          result0 = null;
                                          pos = pos1;
                                        }
                                      } else {
                                        result0 = null;
                                        pos = pos1;
                                      }
                                    } else {
                                      result0 = null;
                                      pos = pos1;
                                    }
                                  } else {
                                    result0 = null;
                                    pos = pos1;
                                  }
                                } else {
                                  result0 = null;
                                  pos = pos1;
                                }
                              } else {
                                result0 = null;
                                pos = pos1;
                              }
                              if (result0 === null) {
                                pos1 = pos;
                                result0 = parse_h16();
                                if (result0 !== null) {
                                  pos2 = pos;
                                  if (input.charCodeAt(pos) === 58) {
                                    result1 = ":";
                                    pos++;
                                  } else {
                                    result1 = null;
                                    if (reportFailures === 0) {
                                      matchFailed("\":\"");
                                    }
                                  }
                                  if (result1 !== null) {
                                    result2 = parse_h16();
                                    if (result2 !== null) {
                                      result1 = [result1, result2];
                                    } else {
                                      result1 = null;
                                      pos = pos2;
                                    }
                                  } else {
                                    result1 = null;
                                    pos = pos2;
                                  }
                                  result1 = result1 !== null ? result1 : "";
                                  if (result1 !== null) {
                                    pos2 = pos;
                                    if (input.charCodeAt(pos) === 58) {
                                      result2 = ":";
                                      pos++;
                                    } else {
                                      result2 = null;
                                      if (reportFailures === 0) {
                                        matchFailed("\":\"");
                                      }
                                    }
                                    if (result2 !== null) {
                                      result3 = parse_h16();
                                      if (result3 !== null) {
                                        result2 = [result2, result3];
                                      } else {
                                        result2 = null;
                                        pos = pos2;
                                      }
                                    } else {
                                      result2 = null;
                                      pos = pos2;
                                    }
                                    result2 = result2 !== null ? result2 : "";
                                    if (result2 !== null) {
                                      pos2 = pos;
                                      if (input.charCodeAt(pos) === 58) {
                                        result3 = ":";
                                        pos++;
                                      } else {
                                        result3 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\":\"");
                                        }
                                      }
                                      if (result3 !== null) {
                                        result4 = parse_h16();
                                        if (result4 !== null) {
                                          result3 = [result3, result4];
                                        } else {
                                          result3 = null;
                                          pos = pos2;
                                        }
                                      } else {
                                        result3 = null;
                                        pos = pos2;
                                      }
                                      result3 = result3 !== null ? result3 : "";
                                      if (result3 !== null) {
                                        pos2 = pos;
                                        if (input.charCodeAt(pos) === 58) {
                                          result4 = ":";
                                          pos++;
                                        } else {
                                          result4 = null;
                                          if (reportFailures === 0) {
                                            matchFailed("\":\"");
                                          }
                                        }
                                        if (result4 !== null) {
                                          result5 = parse_h16();
                                          if (result5 !== null) {
                                            result4 = [result4, result5];
                                          } else {
                                            result4 = null;
                                            pos = pos2;
                                          }
                                        } else {
                                          result4 = null;
                                          pos = pos2;
                                        }
                                        result4 = result4 !== null ? result4 : "";
                                        if (result4 !== null) {
                                          if (input.substr(pos, 2) === "::") {
                                            result5 = "::";
                                            pos += 2;
                                          } else {
                                            result5 = null;
                                            if (reportFailures === 0) {
                                              matchFailed("\"::\"");
                                            }
                                          }
                                          if (result5 !== null) {
                                            result6 = parse_ls32();
                                            if (result6 !== null) {
                                              result0 = [result0, result1, result2, result3, result4, result5, result6];
                                            } else {
                                              result0 = null;
                                              pos = pos1;
                                            }
                                          } else {
                                            result0 = null;
                                            pos = pos1;
                                          }
                                        } else {
                                          result0 = null;
                                          pos = pos1;
                                        }
                                      } else {
                                        result0 = null;
                                        pos = pos1;
                                      }
                                    } else {
                                      result0 = null;
                                      pos = pos1;
                                    }
                                  } else {
                                    result0 = null;
                                    pos = pos1;
                                  }
                                } else {
                                  result0 = null;
                                  pos = pos1;
                                }
                                if (result0 === null) {
                                  pos1 = pos;
                                  result0 = parse_h16();
                                  if (result0 !== null) {
                                    pos2 = pos;
                                    if (input.charCodeAt(pos) === 58) {
                                      result1 = ":";
                                      pos++;
                                    } else {
                                      result1 = null;
                                      if (reportFailures === 0) {
                                        matchFailed("\":\"");
                                      }
                                    }
                                    if (result1 !== null) {
                                      result2 = parse_h16();
                                      if (result2 !== null) {
                                        result1 = [result1, result2];
                                      } else {
                                        result1 = null;
                                        pos = pos2;
                                      }
                                    } else {
                                      result1 = null;
                                      pos = pos2;
                                    }
                                    result1 = result1 !== null ? result1 : "";
                                    if (result1 !== null) {
                                      pos2 = pos;
                                      if (input.charCodeAt(pos) === 58) {
                                        result2 = ":";
                                        pos++;
                                      } else {
                                        result2 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\":\"");
                                        }
                                      }
                                      if (result2 !== null) {
                                        result3 = parse_h16();
                                        if (result3 !== null) {
                                          result2 = [result2, result3];
                                        } else {
                                          result2 = null;
                                          pos = pos2;
                                        }
                                      } else {
                                        result2 = null;
                                        pos = pos2;
                                      }
                                      result2 = result2 !== null ? result2 : "";
                                      if (result2 !== null) {
                                        pos2 = pos;
                                        if (input.charCodeAt(pos) === 58) {
                                          result3 = ":";
                                          pos++;
                                        } else {
                                          result3 = null;
                                          if (reportFailures === 0) {
                                            matchFailed("\":\"");
                                          }
                                        }
                                        if (result3 !== null) {
                                          result4 = parse_h16();
                                          if (result4 !== null) {
                                            result3 = [result3, result4];
                                          } else {
                                            result3 = null;
                                            pos = pos2;
                                          }
                                        } else {
                                          result3 = null;
                                          pos = pos2;
                                        }
                                        result3 = result3 !== null ? result3 : "";
                                        if (result3 !== null) {
                                          pos2 = pos;
                                          if (input.charCodeAt(pos) === 58) {
                                            result4 = ":";
                                            pos++;
                                          } else {
                                            result4 = null;
                                            if (reportFailures === 0) {
                                              matchFailed("\":\"");
                                            }
                                          }
                                          if (result4 !== null) {
                                            result5 = parse_h16();
                                            if (result5 !== null) {
                                              result4 = [result4, result5];
                                            } else {
                                              result4 = null;
                                              pos = pos2;
                                            }
                                          } else {
                                            result4 = null;
                                            pos = pos2;
                                          }
                                          result4 = result4 !== null ? result4 : "";
                                          if (result4 !== null) {
                                            pos2 = pos;
                                            if (input.charCodeAt(pos) === 58) {
                                              result5 = ":";
                                              pos++;
                                            } else {
                                              result5 = null;
                                              if (reportFailures === 0) {
                                                matchFailed("\":\"");
                                              }
                                            }
                                            if (result5 !== null) {
                                              result6 = parse_h16();
                                              if (result6 !== null) {
                                                result5 = [result5, result6];
                                              } else {
                                                result5 = null;
                                                pos = pos2;
                                              }
                                            } else {
                                              result5 = null;
                                              pos = pos2;
                                            }
                                            result5 = result5 !== null ? result5 : "";
                                            if (result5 !== null) {
                                              if (input.substr(pos, 2) === "::") {
                                                result6 = "::";
                                                pos += 2;
                                              } else {
                                                result6 = null;
                                                if (reportFailures === 0) {
                                                  matchFailed("\"::\"");
                                                }
                                              }
                                              if (result6 !== null) {
                                                result7 = parse_h16();
                                                if (result7 !== null) {
                                                  result0 = [result0, result1, result2, result3, result4, result5, result6, result7];
                                                } else {
                                                  result0 = null;
                                                  pos = pos1;
                                                }
                                              } else {
                                                result0 = null;
                                                pos = pos1;
                                              }
                                            } else {
                                              result0 = null;
                                              pos = pos1;
                                            }
                                          } else {
                                            result0 = null;
                                            pos = pos1;
                                          }
                                        } else {
                                          result0 = null;
                                          pos = pos1;
                                        }
                                      } else {
                                        result0 = null;
                                        pos = pos1;
                                      }
                                    } else {
                                      result0 = null;
                                      pos = pos1;
                                    }
                                  } else {
                                    result0 = null;
                                    pos = pos1;
                                  }
                                  if (result0 === null) {
                                    pos1 = pos;
                                    result0 = parse_h16();
                                    if (result0 !== null) {
                                      pos2 = pos;
                                      if (input.charCodeAt(pos) === 58) {
                                        result1 = ":";
                                        pos++;
                                      } else {
                                        result1 = null;
                                        if (reportFailures === 0) {
                                          matchFailed("\":\"");
                                        }
                                      }
                                      if (result1 !== null) {
                                        result2 = parse_h16();
                                        if (result2 !== null) {
                                          result1 = [result1, result2];
                                        } else {
                                          result1 = null;
                                          pos = pos2;
                                        }
                                      } else {
                                        result1 = null;
                                        pos = pos2;
                                      }
                                      result1 = result1 !== null ? result1 : "";
                                      if (result1 !== null) {
                                        pos2 = pos;
                                        if (input.charCodeAt(pos) === 58) {
                                          result2 = ":";
                                          pos++;
                                        } else {
                                          result2 = null;
                                          if (reportFailures === 0) {
                                            matchFailed("\":\"");
                                          }
                                        }
                                        if (result2 !== null) {
                                          result3 = parse_h16();
                                          if (result3 !== null) {
                                            result2 = [result2, result3];
                                          } else {
                                            result2 = null;
                                            pos = pos2;
                                          }
                                        } else {
                                          result2 = null;
                                          pos = pos2;
                                        }
                                        result2 = result2 !== null ? result2 : "";
                                        if (result2 !== null) {
                                          pos2 = pos;
                                          if (input.charCodeAt(pos) === 58) {
                                            result3 = ":";
                                            pos++;
                                          } else {
                                            result3 = null;
                                            if (reportFailures === 0) {
                                              matchFailed("\":\"");
                                            }
                                          }
                                          if (result3 !== null) {
                                            result4 = parse_h16();
                                            if (result4 !== null) {
                                              result3 = [result3, result4];
                                            } else {
                                              result3 = null;
                                              pos = pos2;
                                            }
                                          } else {
                                            result3 = null;
                                            pos = pos2;
                                          }
                                          result3 = result3 !== null ? result3 : "";
                                          if (result3 !== null) {
                                            pos2 = pos;
                                            if (input.charCodeAt(pos) === 58) {
                                              result4 = ":";
                                              pos++;
                                            } else {
                                              result4 = null;
                                              if (reportFailures === 0) {
                                                matchFailed("\":\"");
                                              }
                                            }
                                            if (result4 !== null) {
                                              result5 = parse_h16();
                                              if (result5 !== null) {
                                                result4 = [result4, result5];
                                              } else {
                                                result4 = null;
                                                pos = pos2;
                                              }
                                            } else {
                                              result4 = null;
                                              pos = pos2;
                                            }
                                            result4 = result4 !== null ? result4 : "";
                                            if (result4 !== null) {
                                              pos2 = pos;
                                              if (input.charCodeAt(pos) === 58) {
                                                result5 = ":";
                                                pos++;
                                              } else {
                                                result5 = null;
                                                if (reportFailures === 0) {
                                                  matchFailed("\":\"");
                                                }
                                              }
                                              if (result5 !== null) {
                                                result6 = parse_h16();
                                                if (result6 !== null) {
                                                  result5 = [result5, result6];
                                                } else {
                                                  result5 = null;
                                                  pos = pos2;
                                                }
                                              } else {
                                                result5 = null;
                                                pos = pos2;
                                              }
                                              result5 = result5 !== null ? result5 : "";
                                              if (result5 !== null) {
                                                pos2 = pos;
                                                if (input.charCodeAt(pos) === 58) {
                                                  result6 = ":";
                                                  pos++;
                                                } else {
                                                  result6 = null;
                                                  if (reportFailures === 0) {
                                                    matchFailed("\":\"");
                                                  }
                                                }
                                                if (result6 !== null) {
                                                  result7 = parse_h16();
                                                  if (result7 !== null) {
                                                    result6 = [result6, result7];
                                                  } else {
                                                    result6 = null;
                                                    pos = pos2;
                                                  }
                                                } else {
                                                  result6 = null;
                                                  pos = pos2;
                                                }
                                                result6 = result6 !== null ? result6 : "";
                                                if (result6 !== null) {
                                                  if (input.substr(pos, 2) === "::") {
                                                    result7 = "::";
                                                    pos += 2;
                                                  } else {
                                                    result7 = null;
                                                    if (reportFailures === 0) {
                                                      matchFailed("\"::\"");
                                                    }
                                                  }
                                                  if (result7 !== null) {
                                                    result0 = [result0, result1, result2, result3, result4, result5, result6, result7];
                                                  } else {
                                                    result0 = null;
                                                    pos = pos1;
                                                  }
                                                } else {
                                                  result0 = null;
                                                  pos = pos1;
                                                }
                                              } else {
                                                result0 = null;
                                                pos = pos1;
                                              }
                                            } else {
                                              result0 = null;
                                              pos = pos1;
                                            }
                                          } else {
                                            result0 = null;
                                            pos = pos1;
                                          }
                                        } else {
                                          result0 = null;
                                          pos = pos1;
                                        }
                                      } else {
                                        result0 = null;
                                        pos = pos1;
                                      }
                                    } else {
                                      result0 = null;
                                      pos = pos1;
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          data.host_type = 'IPv6';
                          return input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_h16() {
        var result0, result1, result2, result3;
        var pos0;
        pos0 = pos;
        result0 = parse_HEXDIG();
        if (result0 !== null) {
          result1 = parse_HEXDIG();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result2 = parse_HEXDIG();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result3 = parse_HEXDIG();
              result3 = result3 !== null ? result3 : "";
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_ls32() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_h16();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 58) {
            result1 = ":";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\":\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_h16();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        if (result0 === null) {
          result0 = parse_IPv4address();
        }
        return result0;
      }
      function parse_IPv4address() {
        var result0, result1, result2, result3, result4, result5, result6;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_dec_octet();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 46) {
            result1 = ".";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\".\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_dec_octet();
            if (result2 !== null) {
              if (input.charCodeAt(pos) === 46) {
                result3 = ".";
                pos++;
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("\".\"");
                }
              }
              if (result3 !== null) {
                result4 = parse_dec_octet();
                if (result4 !== null) {
                  if (input.charCodeAt(pos) === 46) {
                    result5 = ".";
                    pos++;
                  } else {
                    result5 = null;
                    if (reportFailures === 0) {
                      matchFailed("\".\"");
                    }
                  }
                  if (result5 !== null) {
                    result6 = parse_dec_octet();
                    if (result6 !== null) {
                      result0 = [result0, result1, result2, result3, result4, result5, result6];
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            data.host_type = 'IPv4';
                            return input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_dec_octet() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 2) === "25") {
          result0 = "25";
          pos += 2;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"25\"");
          }
        }
        if (result0 !== null) {
          if (/^[0-5]/.test(input.charAt(pos))) {
            result1 = input.charAt(pos);
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[0-5]");
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        if (result0 === null) {
          pos0 = pos;
          if (input.charCodeAt(pos) === 50) {
            result0 = "2";
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"2\"");
            }
          }
          if (result0 !== null) {
            if (/^[0-4]/.test(input.charAt(pos))) {
              result1 = input.charAt(pos);
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[0-4]");
              }
            }
            if (result1 !== null) {
              result2 = parse_DIGIT();
              if (result2 !== null) {
                result0 = [result0, result1, result2];
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
          if (result0 === null) {
            pos0 = pos;
            if (input.charCodeAt(pos) === 49) {
              result0 = "1";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"1\"");
              }
            }
            if (result0 !== null) {
              result1 = parse_DIGIT();
              if (result1 !== null) {
                result2 = parse_DIGIT();
                if (result2 !== null) {
                  result0 = [result0, result1, result2];
                } else {
                  result0 = null;
                  pos = pos0;
                }
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
            if (result0 === null) {
              pos0 = pos;
              if (/^[1-9]/.test(input.charAt(pos))) {
                result0 = input.charAt(pos);
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("[1-9]");
                }
              }
              if (result0 !== null) {
                result1 = parse_DIGIT();
                if (result1 !== null) {
                  result0 = [result0, result1];
                } else {
                  result0 = null;
                  pos = pos0;
                }
              } else {
                result0 = null;
                pos = pos0;
              }
              if (result0 === null) {
                result0 = parse_DIGIT();
              }
            }
          }
        }
        return result0;
      }
      function parse_port() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_DIGIT();
        result0 = result0 !== null ? result0 : "";
        if (result0 !== null) {
          result1 = parse_DIGIT();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result2 = parse_DIGIT();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result3 = parse_DIGIT();
              result3 = result3 !== null ? result3 : "";
              if (result3 !== null) {
                result4 = parse_DIGIT();
                result4 = result4 !== null ? result4 : "";
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, port) {
                            port = parseInt(port.join(''));
                            data.port = port;
                            return port; })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_uri_parameters() {
        var result0, result1, result2;
        var pos0;
        result0 = [];
        pos0 = pos;
        if (input.charCodeAt(pos) === 59) {
          result1 = ";";
          pos++;
        } else {
          result1 = null;
          if (reportFailures === 0) {
            matchFailed("\";\"");
          }
        }
        if (result1 !== null) {
          result2 = parse_uri_parameter();
          if (result2 !== null) {
            result1 = [result1, result2];
          } else {
            result1 = null;
            pos = pos0;
          }
        } else {
          result1 = null;
          pos = pos0;
        }
        while (result1 !== null) {
          result0.push(result1);
          pos0 = pos;
          if (input.charCodeAt(pos) === 59) {
            result1 = ";";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\";\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_uri_parameter();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos0;
            }
          } else {
            result1 = null;
            pos = pos0;
          }
        }
        return result0;
      }
      function parse_uri_parameter() {
        var result0;
        result0 = parse_transport_param();
        if (result0 === null) {
          result0 = parse_user_param();
          if (result0 === null) {
            result0 = parse_method_param();
            if (result0 === null) {
              result0 = parse_ttl_param();
              if (result0 === null) {
                result0 = parse_maddr_param();
                if (result0 === null) {
                  result0 = parse_lr_param();
                  if (result0 === null) {
                    result0 = parse_other_param();
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_transport_param() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 10).toLowerCase() === "transport=") {
          result0 = input.substr(pos, 10);
          pos += 10;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"transport=\"");
          }
        }
        if (result0 !== null) {
          if (input.substr(pos, 3).toLowerCase() === "udp") {
            result1 = input.substr(pos, 3);
            pos += 3;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"udp\"");
            }
          }
          if (result1 === null) {
            if (input.substr(pos, 3).toLowerCase() === "tcp") {
              result1 = input.substr(pos, 3);
              pos += 3;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\"tcp\"");
              }
            }
            if (result1 === null) {
              if (input.substr(pos, 4).toLowerCase() === "sctp") {
                result1 = input.substr(pos, 4);
                pos += 4;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"sctp\"");
                }
              }
              if (result1 === null) {
                if (input.substr(pos, 3).toLowerCase() === "tls") {
                  result1 = input.substr(pos, 3);
                  pos += 3;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"tls\"");
                  }
                }
                if (result1 === null) {
                  result1 = parse_token();
                }
              }
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, transport) {
                              if(!data.uri_params) data.uri_params={};
                              data.uri_params['transport'] = transport.toLowerCase(); })(pos0, result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_user_param() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 5).toLowerCase() === "user=") {
          result0 = input.substr(pos, 5);
          pos += 5;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"user=\"");
          }
        }
        if (result0 !== null) {
          if (input.substr(pos, 5).toLowerCase() === "phone") {
            result1 = input.substr(pos, 5);
            pos += 5;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"phone\"");
            }
          }
          if (result1 === null) {
            if (input.substr(pos, 2).toLowerCase() === "ip") {
              result1 = input.substr(pos, 2);
              pos += 2;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\"ip\"");
              }
            }
            if (result1 === null) {
              result1 = parse_token();
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, user) {
                              if(!data.uri_params) data.uri_params={};
                              data.uri_params['user'] = user.toLowerCase(); })(pos0, result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_method_param() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 7).toLowerCase() === "method=") {
          result0 = input.substr(pos, 7);
          pos += 7;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"method=\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_Method();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, method) {
                              if(!data.uri_params) data.uri_params={};
                              data.uri_params['method'] = method; })(pos0, result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_ttl_param() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 4).toLowerCase() === "ttl=") {
          result0 = input.substr(pos, 4);
          pos += 4;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"ttl=\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_ttl();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, ttl) {
                              if(!data.params) data.params={};
                              data.params['ttl'] = ttl; })(pos0, result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_maddr_param() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 6).toLowerCase() === "maddr=") {
          result0 = input.substr(pos, 6);
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"maddr=\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_host();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, maddr) {
                              if(!data.uri_params) data.uri_params={};
                              data.uri_params['maddr'] = maddr; })(pos0, result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_lr_param() {
        var result0, result1, result2;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 2).toLowerCase() === "lr") {
          result0 = input.substr(pos, 2);
          pos += 2;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"lr\"");
          }
        }
        if (result0 !== null) {
          pos2 = pos;
          if (input.charCodeAt(pos) === 61) {
            result1 = "=";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"=\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_token();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos2;
            }
          } else {
            result1 = null;
            pos = pos2;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                              if(!data.uri_params) data.uri_params={};
                              data.uri_params['lr'] = undefined; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_other_param() {
        var result0, result1, result2;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_pname();
        if (result0 !== null) {
          pos2 = pos;
          if (input.charCodeAt(pos) === 61) {
            result1 = "=";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"=\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_pvalue();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos2;
            }
          } else {
            result1 = null;
            pos = pos2;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, param, value) {
                              if(!data.uri_params) data.uri_params = {};
                              if (typeof value === 'undefined'){
                                value = undefined;
                              }
                              else {
                                value = value[1];
                              }
                              data.uri_params[param.toLowerCase()] = value;})(pos0, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_pname() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result1 = parse_paramchar();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_paramchar();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, pname) {return pname.join(''); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_pvalue() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result1 = parse_paramchar();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_paramchar();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, pvalue) {return pvalue.join(''); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_paramchar() {
        var result0;
        result0 = parse_param_unreserved();
        if (result0 === null) {
          result0 = parse_unreserved();
          if (result0 === null) {
            result0 = parse_escaped();
          }
        }
        return result0;
      }
      function parse_param_unreserved() {
        var result0;
        if (input.charCodeAt(pos) === 91) {
          result0 = "[";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"[\"");
          }
        }
        if (result0 === null) {
          if (input.charCodeAt(pos) === 93) {
            result0 = "]";
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"]\"");
            }
          }
          if (result0 === null) {
            if (input.charCodeAt(pos) === 47) {
              result0 = "/";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"/\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos) === 58) {
                result0 = ":";
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\":\"");
                }
              }
              if (result0 === null) {
                if (input.charCodeAt(pos) === 38) {
                  result0 = "&";
                  pos++;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"&\"");
                  }
                }
                if (result0 === null) {
                  if (input.charCodeAt(pos) === 43) {
                    result0 = "+";
                    pos++;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"+\"");
                    }
                  }
                  if (result0 === null) {
                    if (input.charCodeAt(pos) === 36) {
                      result0 = "$";
                      pos++;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"$\"");
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_headers() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        pos0 = pos;
        if (input.charCodeAt(pos) === 63) {
          result0 = "?";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"?\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_header();
          if (result1 !== null) {
            result2 = [];
            pos1 = pos;
            if (input.charCodeAt(pos) === 38) {
              result3 = "&";
              pos++;
            } else {
              result3 = null;
              if (reportFailures === 0) {
                matchFailed("\"&\"");
              }
            }
            if (result3 !== null) {
              result4 = parse_header();
              if (result4 !== null) {
                result3 = [result3, result4];
              } else {
                result3 = null;
                pos = pos1;
              }
            } else {
              result3 = null;
              pos = pos1;
            }
            while (result3 !== null) {
              result2.push(result3);
              pos1 = pos;
              if (input.charCodeAt(pos) === 38) {
                result3 = "&";
                pos++;
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("\"&\"");
                }
              }
              if (result3 !== null) {
                result4 = parse_header();
                if (result4 !== null) {
                  result3 = [result3, result4];
                } else {
                  result3 = null;
                  pos = pos1;
                }
              } else {
                result3 = null;
                pos = pos1;
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_header() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_hname();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 61) {
            result1 = "=";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"=\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_hvalue();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, hname, hvalue) {
                              hname = hname.join('').toLowerCase();
                              hvalue = hvalue.join('');
                              if(!data.uri_headers) data.uri_headers = {};
                              if (!data.uri_headers[hname]) {
                                data.uri_headers[hname] = [hvalue];
                              } else {
                                data.uri_headers[hname].push(hvalue);
                              }})(pos0, result0[0], result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_hname() {
        var result0, result1;
        result1 = parse_hnv_unreserved();
        if (result1 === null) {
          result1 = parse_unreserved();
          if (result1 === null) {
            result1 = parse_escaped();
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_hnv_unreserved();
            if (result1 === null) {
              result1 = parse_unreserved();
              if (result1 === null) {
                result1 = parse_escaped();
              }
            }
          }
        } else {
          result0 = null;
        }
        return result0;
      }
      function parse_hvalue() {
        var result0, result1;
        result0 = [];
        result1 = parse_hnv_unreserved();
        if (result1 === null) {
          result1 = parse_unreserved();
          if (result1 === null) {
            result1 = parse_escaped();
          }
        }
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_hnv_unreserved();
          if (result1 === null) {
            result1 = parse_unreserved();
            if (result1 === null) {
              result1 = parse_escaped();
            }
          }
        }
        return result0;
      }
      function parse_hnv_unreserved() {
        var result0;
        if (input.charCodeAt(pos) === 91) {
          result0 = "[";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"[\"");
          }
        }
        if (result0 === null) {
          if (input.charCodeAt(pos) === 93) {
            result0 = "]";
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"]\"");
            }
          }
          if (result0 === null) {
            if (input.charCodeAt(pos) === 47) {
              result0 = "/";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"/\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos) === 63) {
                result0 = "?";
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"?\"");
                }
              }
              if (result0 === null) {
                if (input.charCodeAt(pos) === 58) {
                  result0 = ":";
                  pos++;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\":\"");
                  }
                }
                if (result0 === null) {
                  if (input.charCodeAt(pos) === 43) {
                    result0 = "+";
                    pos++;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"+\"");
                    }
                  }
                  if (result0 === null) {
                    if (input.charCodeAt(pos) === 36) {
                      result0 = "$";
                      pos++;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"$\"");
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_Request_Response() {
        var result0;
        result0 = parse_Status_Line();
        if (result0 === null) {
          result0 = parse_Request_Line();
        }
        return result0;
      }
      function parse_Request_Line() {
        var result0, result1, result2, result3, result4;
        var pos0;
        pos0 = pos;
        result0 = parse_Method();
        if (result0 !== null) {
          result1 = parse_SP();
          if (result1 !== null) {
            result2 = parse_Request_URI();
            if (result2 !== null) {
              result3 = parse_SP();
              if (result3 !== null) {
                result4 = parse_SIP_Version();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos0;
                }
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Request_URI() {
        var result0;
        result0 = parse_SIP_URI();
        if (result0 === null) {
          result0 = parse_absoluteURI();
        }
        return result0;
      }
      function parse_absoluteURI() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_scheme();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 58) {
            result1 = ":";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\":\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_hier_part();
            if (result2 === null) {
              result2 = parse_opaque_part();
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_hier_part() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_net_path();
        if (result0 === null) {
          result0 = parse_abs_path();
        }
        if (result0 !== null) {
          pos1 = pos;
          if (input.charCodeAt(pos) === 63) {
            result1 = "?";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"?\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_query();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos1;
            }
          } else {
            result1 = null;
            pos = pos1;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_net_path() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 2) === "//") {
          result0 = "//";
          pos += 2;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"//\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_authority();
          if (result1 !== null) {
            result2 = parse_abs_path();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_abs_path() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        if (input.charCodeAt(pos) === 47) {
          result0 = "/";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"/\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_path_segments();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_opaque_part() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_uric_no_slash();
        if (result0 !== null) {
          result1 = [];
          result2 = parse_uric();
          while (result2 !== null) {
            result1.push(result2);
            result2 = parse_uric();
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_uric() {
        var result0;
        result0 = parse_reserved();
        if (result0 === null) {
          result0 = parse_unreserved();
          if (result0 === null) {
            result0 = parse_escaped();
          }
        }
        return result0;
      }
      function parse_uric_no_slash() {
        var result0;
        result0 = parse_unreserved();
        if (result0 === null) {
          result0 = parse_escaped();
          if (result0 === null) {
            if (input.charCodeAt(pos) === 59) {
              result0 = ";";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\";\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos) === 63) {
                result0 = "?";
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"?\"");
                }
              }
              if (result0 === null) {
                if (input.charCodeAt(pos) === 58) {
                  result0 = ":";
                  pos++;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\":\"");
                  }
                }
                if (result0 === null) {
                  if (input.charCodeAt(pos) === 64) {
                    result0 = "@";
                    pos++;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"@\"");
                    }
                  }
                  if (result0 === null) {
                    if (input.charCodeAt(pos) === 38) {
                      result0 = "&";
                      pos++;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"&\"");
                      }
                    }
                    if (result0 === null) {
                      if (input.charCodeAt(pos) === 61) {
                        result0 = "=";
                        pos++;
                      } else {
                        result0 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"=\"");
                        }
                      }
                      if (result0 === null) {
                        if (input.charCodeAt(pos) === 43) {
                          result0 = "+";
                          pos++;
                        } else {
                          result0 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"+\"");
                          }
                        }
                        if (result0 === null) {
                          if (input.charCodeAt(pos) === 36) {
                            result0 = "$";
                            pos++;
                          } else {
                            result0 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"$\"");
                            }
                          }
                          if (result0 === null) {
                            if (input.charCodeAt(pos) === 44) {
                              result0 = ",";
                              pos++;
                            } else {
                              result0 = null;
                              if (reportFailures === 0) {
                                matchFailed("\",\"");
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_path_segments() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_segment();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          if (input.charCodeAt(pos) === 47) {
            result2 = "/";
            pos++;
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("\"/\"");
            }
          }
          if (result2 !== null) {
            result3 = parse_segment();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            if (input.charCodeAt(pos) === 47) {
              result2 = "/";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"/\"");
              }
            }
            if (result2 !== null) {
              result3 = parse_segment();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_segment() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = [];
        result1 = parse_pchar();
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_pchar();
        }
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          if (input.charCodeAt(pos) === 59) {
            result2 = ";";
            pos++;
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("\";\"");
            }
          }
          if (result2 !== null) {
            result3 = parse_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            if (input.charCodeAt(pos) === 59) {
              result2 = ";";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\";\"");
              }
            }
            if (result2 !== null) {
              result3 = parse_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_param() {
        var result0, result1;
        result0 = [];
        result1 = parse_pchar();
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_pchar();
        }
        return result0;
      }
      function parse_pchar() {
        var result0;
        result0 = parse_unreserved();
        if (result0 === null) {
          result0 = parse_escaped();
          if (result0 === null) {
            if (input.charCodeAt(pos) === 58) {
              result0 = ":";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\":\"");
              }
            }
            if (result0 === null) {
              if (input.charCodeAt(pos) === 64) {
                result0 = "@";
                pos++;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"@\"");
                }
              }
              if (result0 === null) {
                if (input.charCodeAt(pos) === 38) {
                  result0 = "&";
                  pos++;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"&\"");
                  }
                }
                if (result0 === null) {
                  if (input.charCodeAt(pos) === 61) {
                    result0 = "=";
                    pos++;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"=\"");
                    }
                  }
                  if (result0 === null) {
                    if (input.charCodeAt(pos) === 43) {
                      result0 = "+";
                      pos++;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"+\"");
                      }
                    }
                    if (result0 === null) {
                      if (input.charCodeAt(pos) === 36) {
                        result0 = "$";
                        pos++;
                      } else {
                        result0 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"$\"");
                        }
                      }
                      if (result0 === null) {
                        if (input.charCodeAt(pos) === 44) {
                          result0 = ",";
                          pos++;
                        } else {
                          result0 = null;
                          if (reportFailures === 0) {
                            matchFailed("\",\"");
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_scheme() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_ALPHA();
        if (result0 !== null) {
          result1 = [];
          result2 = parse_ALPHA();
          if (result2 === null) {
            result2 = parse_DIGIT();
            if (result2 === null) {
              if (input.charCodeAt(pos) === 43) {
                result2 = "+";
                pos++;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"+\"");
                }
              }
              if (result2 === null) {
                if (input.charCodeAt(pos) === 45) {
                  result2 = "-";
                  pos++;
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"-\"");
                  }
                }
                if (result2 === null) {
                  if (input.charCodeAt(pos) === 46) {
                    result2 = ".";
                    pos++;
                  } else {
                    result2 = null;
                    if (reportFailures === 0) {
                      matchFailed("\".\"");
                    }
                  }
                }
              }
            }
          }
          while (result2 !== null) {
            result1.push(result2);
            result2 = parse_ALPHA();
            if (result2 === null) {
              result2 = parse_DIGIT();
              if (result2 === null) {
                if (input.charCodeAt(pos) === 43) {
                  result2 = "+";
                  pos++;
                } else {
                  result2 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"+\"");
                  }
                }
                if (result2 === null) {
                  if (input.charCodeAt(pos) === 45) {
                    result2 = "-";
                    pos++;
                  } else {
                    result2 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"-\"");
                    }
                  }
                  if (result2 === null) {
                    if (input.charCodeAt(pos) === 46) {
                      result2 = ".";
                      pos++;
                    } else {
                      result2 = null;
                      if (reportFailures === 0) {
                        matchFailed("\".\"");
                      }
                    }
                  }
                }
              }
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            data.scheme= input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_authority() {
        var result0;
        result0 = parse_srvr();
        if (result0 === null) {
          result0 = parse_reg_name();
        }
        return result0;
      }
      function parse_srvr() {
        var result0, result1;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_userinfo();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 64) {
            result1 = "@";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"@\"");
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        result0 = result0 !== null ? result0 : "";
        if (result0 !== null) {
          result1 = parse_hostport();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        result0 = result0 !== null ? result0 : "";
        return result0;
      }
      function parse_reg_name() {
        var result0, result1;
        result1 = parse_unreserved();
        if (result1 === null) {
          result1 = parse_escaped();
          if (result1 === null) {
            if (input.charCodeAt(pos) === 36) {
              result1 = "$";
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\"$\"");
              }
            }
            if (result1 === null) {
              if (input.charCodeAt(pos) === 44) {
                result1 = ",";
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\",\"");
                }
              }
              if (result1 === null) {
                if (input.charCodeAt(pos) === 59) {
                  result1 = ";";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\";\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 58) {
                    result1 = ":";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\":\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 64) {
                      result1 = "@";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"@\"");
                      }
                    }
                    if (result1 === null) {
                      if (input.charCodeAt(pos) === 38) {
                        result1 = "&";
                        pos++;
                      } else {
                        result1 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"&\"");
                        }
                      }
                      if (result1 === null) {
                        if (input.charCodeAt(pos) === 61) {
                          result1 = "=";
                          pos++;
                        } else {
                          result1 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"=\"");
                          }
                        }
                        if (result1 === null) {
                          if (input.charCodeAt(pos) === 43) {
                            result1 = "+";
                            pos++;
                          } else {
                            result1 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"+\"");
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_unreserved();
            if (result1 === null) {
              result1 = parse_escaped();
              if (result1 === null) {
                if (input.charCodeAt(pos) === 36) {
                  result1 = "$";
                  pos++;
                } else {
                  result1 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"$\"");
                  }
                }
                if (result1 === null) {
                  if (input.charCodeAt(pos) === 44) {
                    result1 = ",";
                    pos++;
                  } else {
                    result1 = null;
                    if (reportFailures === 0) {
                      matchFailed("\",\"");
                    }
                  }
                  if (result1 === null) {
                    if (input.charCodeAt(pos) === 59) {
                      result1 = ";";
                      pos++;
                    } else {
                      result1 = null;
                      if (reportFailures === 0) {
                        matchFailed("\";\"");
                      }
                    }
                    if (result1 === null) {
                      if (input.charCodeAt(pos) === 58) {
                        result1 = ":";
                        pos++;
                      } else {
                        result1 = null;
                        if (reportFailures === 0) {
                          matchFailed("\":\"");
                        }
                      }
                      if (result1 === null) {
                        if (input.charCodeAt(pos) === 64) {
                          result1 = "@";
                          pos++;
                        } else {
                          result1 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"@\"");
                          }
                        }
                        if (result1 === null) {
                          if (input.charCodeAt(pos) === 38) {
                            result1 = "&";
                            pos++;
                          } else {
                            result1 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"&\"");
                            }
                          }
                          if (result1 === null) {
                            if (input.charCodeAt(pos) === 61) {
                              result1 = "=";
                              pos++;
                            } else {
                              result1 = null;
                              if (reportFailures === 0) {
                                matchFailed("\"=\"");
                              }
                            }
                            if (result1 === null) {
                              if (input.charCodeAt(pos) === 43) {
                                result1 = "+";
                                pos++;
                              } else {
                                result1 = null;
                                if (reportFailures === 0) {
                                  matchFailed("\"+\"");
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          result0 = null;
        }
        return result0;
      }
      function parse_query() {
        var result0, result1;
        result0 = [];
        result1 = parse_uric();
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_uric();
        }
        return result0;
      }
      function parse_SIP_Version() {
        var result0, result1, result2, result3, result4, result5;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 3).toLowerCase() === "sip") {
          result0 = input.substr(pos, 3);
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"SIP\"");
          }
        }
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 47) {
            result1 = "/";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"/\"");
            }
          }
          if (result1 !== null) {
            result3 = parse_DIGIT();
            if (result3 !== null) {
              result2 = [];
              while (result3 !== null) {
                result2.push(result3);
                result3 = parse_DIGIT();
              }
            } else {
              result2 = null;
            }
            if (result2 !== null) {
              if (input.charCodeAt(pos) === 46) {
                result3 = ".";
                pos++;
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("\".\"");
                }
              }
              if (result3 !== null) {
                result5 = parse_DIGIT();
                if (result5 !== null) {
                  result4 = [];
                  while (result5 !== null) {
                    result4.push(result5);
                    result5 = parse_DIGIT();
                  }
                } else {
                  result4 = null;
                }
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            data.sip_version = input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_INVITEm() {
        var result0;
        if (input.substr(pos, 6) === "INVITE") {
          result0 = "INVITE";
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"INVITE\"");
          }
        }
        return result0;
      }
      function parse_ACKm() {
        var result0;
        if (input.substr(pos, 3) === "ACK") {
          result0 = "ACK";
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"ACK\"");
          }
        }
        return result0;
      }
      function parse_OPTIONSm() {
        var result0;
        if (input.substr(pos, 7) === "OPTIONS") {
          result0 = "OPTIONS";
          pos += 7;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"OPTIONS\"");
          }
        }
        return result0;
      }
      function parse_BYEm() {
        var result0;
        if (input.substr(pos, 3) === "BYE") {
          result0 = "BYE";
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"BYE\"");
          }
        }
        return result0;
      }
      function parse_CANCELm() {
        var result0;
        if (input.substr(pos, 6) === "CANCEL") {
          result0 = "CANCEL";
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"CANCEL\"");
          }
        }
        return result0;
      }
      function parse_REGISTERm() {
        var result0;
        if (input.substr(pos, 8) === "REGISTER") {
          result0 = "REGISTER";
          pos += 8;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"REGISTER\"");
          }
        }
        return result0;
      }
      function parse_SUBSCRIBEm() {
        var result0;
        if (input.substr(pos, 9) === "SUBSCRIBE") {
          result0 = "SUBSCRIBE";
          pos += 9;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"SUBSCRIBE\"");
          }
        }
        return result0;
      }
      function parse_NOTIFYm() {
        var result0;
        if (input.substr(pos, 6) === "NOTIFY") {
          result0 = "NOTIFY";
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"NOTIFY\"");
          }
        }
        return result0;
      }
      function parse_REFERm() {
        var result0;
        if (input.substr(pos, 5) === "REFER") {
          result0 = "REFER";
          pos += 5;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"REFER\"");
          }
        }
        return result0;
      }
      function parse_Method() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_INVITEm();
        if (result0 === null) {
          result0 = parse_ACKm();
          if (result0 === null) {
            result0 = parse_OPTIONSm();
            if (result0 === null) {
              result0 = parse_BYEm();
              if (result0 === null) {
                result0 = parse_CANCELm();
                if (result0 === null) {
                  result0 = parse_REGISTERm();
                  if (result0 === null) {
                    result0 = parse_SUBSCRIBEm();
                    if (result0 === null) {
                      result0 = parse_NOTIFYm();
                      if (result0 === null) {
                        result0 = parse_REFERm();
                        if (result0 === null) {
                          result0 = parse_token();
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            data.method = input.substring(pos, offset);
                            return data.method; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Status_Line() {
        var result0, result1, result2, result3, result4;
        var pos0;
        pos0 = pos;
        result0 = parse_SIP_Version();
        if (result0 !== null) {
          result1 = parse_SP();
          if (result1 !== null) {
            result2 = parse_Status_Code();
            if (result2 !== null) {
              result3 = parse_SP();
              if (result3 !== null) {
                result4 = parse_Reason_Phrase();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos0;
                }
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Status_Code() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_extension_code();
        if (result0 !== null) {
          result0 = (function(offset, status_code) {
                          data.status_code = parseInt(status_code.join('')); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_extension_code() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_DIGIT();
        if (result0 !== null) {
          result1 = parse_DIGIT();
          if (result1 !== null) {
            result2 = parse_DIGIT();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Reason_Phrase() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result0 = [];
        result1 = parse_reserved();
        if (result1 === null) {
          result1 = parse_unreserved();
          if (result1 === null) {
            result1 = parse_escaped();
            if (result1 === null) {
              result1 = parse_UTF8_NONASCII();
              if (result1 === null) {
                result1 = parse_UTF8_CONT();
                if (result1 === null) {
                  result1 = parse_SP();
                  if (result1 === null) {
                    result1 = parse_HTAB();
                  }
                }
              }
            }
          }
        }
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_reserved();
          if (result1 === null) {
            result1 = parse_unreserved();
            if (result1 === null) {
              result1 = parse_escaped();
              if (result1 === null) {
                result1 = parse_UTF8_NONASCII();
                if (result1 === null) {
                  result1 = parse_UTF8_CONT();
                  if (result1 === null) {
                    result1 = parse_SP();
                    if (result1 === null) {
                      result1 = parse_HTAB();
                    }
                  }
                }
              }
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          data.reason_phrase = input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Allow_Events() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_event_type();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_COMMA();
          if (result2 !== null) {
            result3 = parse_event_type();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_COMMA();
            if (result2 !== null) {
              result3 = parse_event_type();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Call_ID() {
        var result0, result1, result2;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_word();
        if (result0 !== null) {
          pos2 = pos;
          if (input.charCodeAt(pos) === 64) {
            result1 = "@";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"@\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_word();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos2;
            }
          } else {
            result1 = null;
            pos = pos2;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                      data = input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Contact() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        result0 = parse_STAR();
        if (result0 === null) {
          pos1 = pos;
          result0 = parse_contact_param();
          if (result0 !== null) {
            result1 = [];
            pos2 = pos;
            result2 = parse_COMMA();
            if (result2 !== null) {
              result3 = parse_contact_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
            while (result2 !== null) {
              result1.push(result2);
              pos2 = pos;
              result2 = parse_COMMA();
              if (result2 !== null) {
                result3 = parse_contact_param();
                if (result3 !== null) {
                  result2 = [result2, result3];
                } else {
                  result2 = null;
                  pos = pos2;
                }
              } else {
                result2 = null;
                pos = pos2;
              }
            }
            if (result1 !== null) {
              result0 = [result0, result1];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                                var idx, length;
                                length = data.multi_header.length;
                                for (idx = 0; idx < length; idx++) {
                                  if (data.multi_header[idx].parsed === null) {
                                    data = null;
                                    break;
                                  }
                                }
                                if (data !== null) {
                                  data = data.multi_header;
                                } else {
                                  data = -1;
                                }})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_contact_param() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SIP_URI_noparams();
        if (result0 === null) {
          result0 = parse_name_addr();
        }
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_contact_params();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_contact_params();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                                var header;
                                if(!data.multi_header) data.multi_header = [];
                                try {
                                  header = new NameAddrHeader(data.uri, data.display_name, data.params);
                                  delete data.uri;
                                  delete data.display_name;
                                  delete data.params;
                                } catch(e) {
                                  header = null;
                                }
                                data.multi_header.push( { 'possition': pos,
                                                          'offset': offset,
                                                          'parsed': header
                                                        });})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_name_addr() {
        var result0, result1, result2, result3;
        var pos0;
        pos0 = pos;
        result0 = parse_display_name();
        result0 = result0 !== null ? result0 : "";
        if (result0 !== null) {
          result1 = parse_LAQUOT();
          if (result1 !== null) {
            result2 = parse_SIP_URI();
            if (result2 !== null) {
              result3 = parse_RAQUOT();
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_display_name() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = parse_LWS();
          if (result2 !== null) {
            result3 = parse_token();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = parse_LWS();
            if (result2 !== null) {
              result3 = parse_token();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 === null) {
          result0 = parse_quoted_string();
        }
        if (result0 !== null) {
          result0 = (function(offset, display_name) {
                                display_name = input.substring(pos, offset).trim();
                                if (display_name[0] === '\"') {
                                  display_name = display_name.substring(1, display_name.length-1);
                                }
                                data.display_name = display_name; })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_contact_params() {
        var result0;
        result0 = parse_c_p_q();
        if (result0 === null) {
          result0 = parse_c_p_expires();
          if (result0 === null) {
            result0 = parse_generic_param();
          }
        }
        return result0;
      }
      function parse_c_p_q() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 1).toLowerCase() === "q") {
          result0 = input.substr(pos, 1);
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"q\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_qvalue();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, q) {
                                if(!data.params) data.params = {};
                                data.params['q'] = q; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_c_p_expires() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 7).toLowerCase() === "expires") {
          result0 = input.substr(pos, 7);
          pos += 7;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"expires\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_delta_seconds();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, expires) {
                                if(!data.params) data.params = {};
                                data.params['expires'] = expires; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_delta_seconds() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result1 = parse_DIGIT();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_DIGIT();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, delta_seconds) {
                                return parseInt(delta_seconds.join('')); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_qvalue() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        if (input.charCodeAt(pos) === 48) {
          result0 = "0";
          pos++;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"0\"");
          }
        }
        if (result0 !== null) {
          pos2 = pos;
          if (input.charCodeAt(pos) === 46) {
            result1 = ".";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\".\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_DIGIT();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result3 = parse_DIGIT();
              result3 = result3 !== null ? result3 : "";
              if (result3 !== null) {
                result4 = parse_DIGIT();
                result4 = result4 !== null ? result4 : "";
                if (result4 !== null) {
                  result1 = [result1, result2, result3, result4];
                } else {
                  result1 = null;
                  pos = pos2;
                }
              } else {
                result1 = null;
                pos = pos2;
              }
            } else {
              result1 = null;
              pos = pos2;
            }
          } else {
            result1 = null;
            pos = pos2;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                                return parseFloat(input.substring(pos, offset)); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_generic_param() {
        var result0, result1, result2;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          pos2 = pos;
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_gen_value();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos2;
            }
          } else {
            result1 = null;
            pos = pos2;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, param, value) {
                                if(!data.params) data.params = {};
                                if (typeof value === 'undefined'){
                                  value = undefined;
                                }
                                else {
                                  value = value[1];
                                }
                                data.params[param.toLowerCase()] = value;})(pos0, result0[0], result0[1]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_gen_value() {
        var result0;
        result0 = parse_token();
        if (result0 === null) {
          result0 = parse_host();
          if (result0 === null) {
            result0 = parse_quoted_string();
          }
        }
        return result0;
      }
      function parse_Content_Disposition() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_disp_type();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_disp_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_disp_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_disp_type() {
        var result0;
        if (input.substr(pos, 6).toLowerCase() === "render") {
          result0 = input.substr(pos, 6);
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"render\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 7).toLowerCase() === "session") {
            result0 = input.substr(pos, 7);
            pos += 7;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"session\"");
            }
          }
          if (result0 === null) {
            if (input.substr(pos, 4).toLowerCase() === "icon") {
              result0 = input.substr(pos, 4);
              pos += 4;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"icon\"");
              }
            }
            if (result0 === null) {
              if (input.substr(pos, 5).toLowerCase() === "alert") {
                result0 = input.substr(pos, 5);
                pos += 5;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"alert\"");
                }
              }
              if (result0 === null) {
                result0 = parse_token();
              }
            }
          }
        }
        return result0;
      }
      function parse_disp_param() {
        var result0;
        result0 = parse_handling_param();
        if (result0 === null) {
          result0 = parse_generic_param();
        }
        return result0;
      }
      function parse_handling_param() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 8).toLowerCase() === "handling") {
          result0 = input.substr(pos, 8);
          pos += 8;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"handling\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            if (input.substr(pos, 8).toLowerCase() === "optional") {
              result2 = input.substr(pos, 8);
              pos += 8;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"optional\"");
              }
            }
            if (result2 === null) {
              if (input.substr(pos, 8).toLowerCase() === "required") {
                result2 = input.substr(pos, 8);
                pos += 8;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"required\"");
                }
              }
              if (result2 === null) {
                result2 = parse_token();
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Content_Encoding() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_COMMA();
          if (result2 !== null) {
            result3 = parse_token();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_COMMA();
            if (result2 !== null) {
              result3 = parse_token();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Content_Length() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result1 = parse_DIGIT();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_DIGIT();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, length) {
                                data = parseInt(length.join('')); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Content_Type() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_media_type();
        if (result0 !== null) {
          result0 = (function(offset) {
                                data = input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_media_type() {
        var result0, result1, result2, result3, result4, result5;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_m_type();
        if (result0 !== null) {
          result1 = parse_SLASH();
          if (result1 !== null) {
            result2 = parse_m_subtype();
            if (result2 !== null) {
              result3 = [];
              pos1 = pos;
              result4 = parse_SEMI();
              if (result4 !== null) {
                result5 = parse_m_parameter();
                if (result5 !== null) {
                  result4 = [result4, result5];
                } else {
                  result4 = null;
                  pos = pos1;
                }
              } else {
                result4 = null;
                pos = pos1;
              }
              while (result4 !== null) {
                result3.push(result4);
                pos1 = pos;
                result4 = parse_SEMI();
                if (result4 !== null) {
                  result5 = parse_m_parameter();
                  if (result5 !== null) {
                    result4 = [result4, result5];
                  } else {
                    result4 = null;
                    pos = pos1;
                  }
                } else {
                  result4 = null;
                  pos = pos1;
                }
              }
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_m_type() {
        var result0;
        result0 = parse_discrete_type();
        if (result0 === null) {
          result0 = parse_composite_type();
        }
        return result0;
      }
      function parse_discrete_type() {
        var result0;
        if (input.substr(pos, 4).toLowerCase() === "text") {
          result0 = input.substr(pos, 4);
          pos += 4;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"text\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 5).toLowerCase() === "image") {
            result0 = input.substr(pos, 5);
            pos += 5;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"image\"");
            }
          }
          if (result0 === null) {
            if (input.substr(pos, 5).toLowerCase() === "audio") {
              result0 = input.substr(pos, 5);
              pos += 5;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"audio\"");
              }
            }
            if (result0 === null) {
              if (input.substr(pos, 5).toLowerCase() === "video") {
                result0 = input.substr(pos, 5);
                pos += 5;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"video\"");
                }
              }
              if (result0 === null) {
                if (input.substr(pos, 11).toLowerCase() === "application") {
                  result0 = input.substr(pos, 11);
                  pos += 11;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"application\"");
                  }
                }
                if (result0 === null) {
                  result0 = parse_extension_token();
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_composite_type() {
        var result0;
        if (input.substr(pos, 7).toLowerCase() === "message") {
          result0 = input.substr(pos, 7);
          pos += 7;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"message\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 9).toLowerCase() === "multipart") {
            result0 = input.substr(pos, 9);
            pos += 9;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"multipart\"");
            }
          }
          if (result0 === null) {
            result0 = parse_extension_token();
          }
        }
        return result0;
      }
      function parse_extension_token() {
        var result0;
        result0 = parse_token();
        if (result0 === null) {
          result0 = parse_x_token();
        }
        return result0;
      }
      function parse_x_token() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 2).toLowerCase() === "x-") {
          result0 = input.substr(pos, 2);
          pos += 2;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"x-\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_token();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_m_subtype() {
        var result0;
        result0 = parse_extension_token();
        if (result0 === null) {
          result0 = parse_token();
        }
        return result0;
      }
      function parse_m_parameter() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_m_value();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_m_value() {
        var result0;
        result0 = parse_token();
        if (result0 === null) {
          result0 = parse_quoted_string();
        }
        return result0;
      }
      function parse_CSeq() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_CSeq_value();
        if (result0 !== null) {
          result1 = parse_LWS();
          if (result1 !== null) {
            result2 = parse_Method();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_CSeq_value() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result1 = parse_DIGIT();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_DIGIT();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, cseq_value) {
                          data.value=parseInt(cseq_value.join('')); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Expires() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_delta_seconds();
        if (result0 !== null) {
          result0 = (function(offset, expires) {data = expires; })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Event() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_event_type();
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_generic_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_generic_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, event_type) {
                               data.event = event_type.join('').toLowerCase(); })(pos0, result0[0]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_event_type() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_token_nodot();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          if (input.charCodeAt(pos) === 46) {
            result2 = ".";
            pos++;
          } else {
            result2 = null;
            if (reportFailures === 0) {
              matchFailed("\".\"");
            }
          }
          if (result2 !== null) {
            result3 = parse_token_nodot();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            if (input.charCodeAt(pos) === 46) {
              result2 = ".";
              pos++;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\".\"");
              }
            }
            if (result2 !== null) {
              result3 = parse_token_nodot();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_From() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SIP_URI_noparams();
        if (result0 === null) {
          result0 = parse_name_addr();
        }
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_from_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_from_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                        var tag = data.tag;
                        try {
                          data = new NameAddrHeader(data.uri, data.display_name, data.params);
                          if (tag) {data.setParam('tag',tag)}
                        } catch(e) {
                          data = -1;
                        }})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_from_param() {
        var result0;
        result0 = parse_tag_param();
        if (result0 === null) {
          result0 = parse_generic_param();
        }
        return result0;
      }
      function parse_tag_param() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 3).toLowerCase() === "tag") {
          result0 = input.substr(pos, 3);
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"tag\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_token();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, tag) {data.tag = tag; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Max_Forwards() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result1 = parse_DIGIT();
        if (result1 !== null) {
          result0 = [];
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_DIGIT();
          }
        } else {
          result0 = null;
        }
        if (result0 !== null) {
          result0 = (function(offset, forwards) {
                          data = parseInt(forwards.join('')); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Min_Expires() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_delta_seconds();
        if (result0 !== null) {
          result0 = (function(offset, min_expires) {data = min_expires; })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Name_Addr_Header() {
        var result0, result1, result2, result3, result4, result5, result6;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = [];
        result1 = parse_display_name();
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_display_name();
        }
        if (result0 !== null) {
          result1 = parse_LAQUOT();
          if (result1 !== null) {
            result2 = parse_SIP_URI();
            if (result2 !== null) {
              result3 = parse_RAQUOT();
              if (result3 !== null) {
                result4 = [];
                pos2 = pos;
                result5 = parse_SEMI();
                if (result5 !== null) {
                  result6 = parse_generic_param();
                  if (result6 !== null) {
                    result5 = [result5, result6];
                  } else {
                    result5 = null;
                    pos = pos2;
                  }
                } else {
                  result5 = null;
                  pos = pos2;
                }
                while (result5 !== null) {
                  result4.push(result5);
                  pos2 = pos;
                  result5 = parse_SEMI();
                  if (result5 !== null) {
                    result6 = parse_generic_param();
                    if (result6 !== null) {
                      result5 = [result5, result6];
                    } else {
                      result5 = null;
                      pos = pos2;
                    }
                  } else {
                    result5 = null;
                    pos = pos2;
                  }
                }
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                              try {
                                data = new NameAddrHeader(data.uri, data.display_name, data.params);
                              } catch(e) {
                                data = -1;
                              }})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Proxy_Authenticate() {
        var result0;
        result0 = parse_challenge();
        return result0;
      }
      function parse_challenge() {
        var result0, result1, result2, result3, result4, result5;
        var pos0, pos1;
        pos0 = pos;
        if (input.substr(pos, 6).toLowerCase() === "digest") {
          result0 = input.substr(pos, 6);
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"Digest\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_LWS();
          if (result1 !== null) {
            result2 = parse_digest_cln();
            if (result2 !== null) {
              result3 = [];
              pos1 = pos;
              result4 = parse_COMMA();
              if (result4 !== null) {
                result5 = parse_digest_cln();
                if (result5 !== null) {
                  result4 = [result4, result5];
                } else {
                  result4 = null;
                  pos = pos1;
                }
              } else {
                result4 = null;
                pos = pos1;
              }
              while (result4 !== null) {
                result3.push(result4);
                pos1 = pos;
                result4 = parse_COMMA();
                if (result4 !== null) {
                  result5 = parse_digest_cln();
                  if (result5 !== null) {
                    result4 = [result4, result5];
                  } else {
                    result4 = null;
                    pos = pos1;
                  }
                } else {
                  result4 = null;
                  pos = pos1;
                }
              }
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        if (result0 === null) {
          result0 = parse_other_challenge();
        }
        return result0;
      }
      function parse_other_challenge() {
        var result0, result1, result2, result3, result4, result5;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          result1 = parse_LWS();
          if (result1 !== null) {
            result2 = parse_auth_param();
            if (result2 !== null) {
              result3 = [];
              pos1 = pos;
              result4 = parse_COMMA();
              if (result4 !== null) {
                result5 = parse_auth_param();
                if (result5 !== null) {
                  result4 = [result4, result5];
                } else {
                  result4 = null;
                  pos = pos1;
                }
              } else {
                result4 = null;
                pos = pos1;
              }
              while (result4 !== null) {
                result3.push(result4);
                pos1 = pos;
                result4 = parse_COMMA();
                if (result4 !== null) {
                  result5 = parse_auth_param();
                  if (result5 !== null) {
                    result4 = [result4, result5];
                  } else {
                    result4 = null;
                    pos = pos1;
                  }
                } else {
                  result4 = null;
                  pos = pos1;
                }
              }
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_auth_param() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_token();
            if (result2 === null) {
              result2 = parse_quoted_string();
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_digest_cln() {
        var result0;
        result0 = parse_realm();
        if (result0 === null) {
          result0 = parse_domain();
          if (result0 === null) {
            result0 = parse_nonce();
            if (result0 === null) {
              result0 = parse_opaque();
              if (result0 === null) {
                result0 = parse_stale();
                if (result0 === null) {
                  result0 = parse_algorithm();
                  if (result0 === null) {
                    result0 = parse_qop_options();
                    if (result0 === null) {
                      result0 = parse_auth_param();
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_realm() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 5).toLowerCase() === "realm") {
          result0 = input.substr(pos, 5);
          pos += 5;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"realm\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_realm_value();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_realm_value() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_quoted_string_clean();
        if (result0 !== null) {
          result0 = (function(offset, realm) { data.realm = realm; })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_domain() {
        var result0, result1, result2, result3, result4, result5, result6;
        var pos0, pos1;
        pos0 = pos;
        if (input.substr(pos, 6).toLowerCase() === "domain") {
          result0 = input.substr(pos, 6);
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"domain\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_LDQUOT();
            if (result2 !== null) {
              result3 = parse_URI();
              if (result3 !== null) {
                result4 = [];
                pos1 = pos;
                result6 = parse_SP();
                if (result6 !== null) {
                  result5 = [];
                  while (result6 !== null) {
                    result5.push(result6);
                    result6 = parse_SP();
                  }
                } else {
                  result5 = null;
                }
                if (result5 !== null) {
                  result6 = parse_URI();
                  if (result6 !== null) {
                    result5 = [result5, result6];
                  } else {
                    result5 = null;
                    pos = pos1;
                  }
                } else {
                  result5 = null;
                  pos = pos1;
                }
                while (result5 !== null) {
                  result4.push(result5);
                  pos1 = pos;
                  result6 = parse_SP();
                  if (result6 !== null) {
                    result5 = [];
                    while (result6 !== null) {
                      result5.push(result6);
                      result6 = parse_SP();
                    }
                  } else {
                    result5 = null;
                  }
                  if (result5 !== null) {
                    result6 = parse_URI();
                    if (result6 !== null) {
                      result5 = [result5, result6];
                    } else {
                      result5 = null;
                      pos = pos1;
                    }
                  } else {
                    result5 = null;
                    pos = pos1;
                  }
                }
                if (result4 !== null) {
                  result5 = parse_RDQUOT();
                  if (result5 !== null) {
                    result0 = [result0, result1, result2, result3, result4, result5];
                  } else {
                    result0 = null;
                    pos = pos0;
                  }
                } else {
                  result0 = null;
                  pos = pos0;
                }
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_URI() {
        var result0;
        result0 = parse_absoluteURI();
        if (result0 === null) {
          result0 = parse_abs_path();
        }
        return result0;
      }
      function parse_nonce() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 5).toLowerCase() === "nonce") {
          result0 = input.substr(pos, 5);
          pos += 5;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"nonce\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_nonce_value();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_nonce_value() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_quoted_string_clean();
        if (result0 !== null) {
          result0 = (function(offset, nonce) { data.nonce=nonce; })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_opaque() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 6).toLowerCase() === "opaque") {
          result0 = input.substr(pos, 6);
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"opaque\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_quoted_string_clean();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, opaque) { data.opaque=opaque; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_stale() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        if (input.substr(pos, 5).toLowerCase() === "stale") {
          result0 = input.substr(pos, 5);
          pos += 5;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"stale\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            pos1 = pos;
            if (input.substr(pos, 4).toLowerCase() === "true") {
              result2 = input.substr(pos, 4);
              pos += 4;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"true\"");
              }
            }
            if (result2 !== null) {
              result2 = (function(offset) { data.stale=true; })(pos1);
            }
            if (result2 === null) {
              pos = pos1;
            }
            if (result2 === null) {
              pos1 = pos;
              if (input.substr(pos, 5).toLowerCase() === "false") {
                result2 = input.substr(pos, 5);
                pos += 5;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"false\"");
                }
              }
              if (result2 !== null) {
                result2 = (function(offset) { data.stale=false; })(pos1);
              }
              if (result2 === null) {
                pos = pos1;
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_algorithm() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 9).toLowerCase() === "algorithm") {
          result0 = input.substr(pos, 9);
          pos += 9;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"algorithm\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            if (input.substr(pos, 3).toLowerCase() === "md5") {
              result2 = input.substr(pos, 3);
              pos += 3;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"MD5\"");
              }
            }
            if (result2 === null) {
              if (input.substr(pos, 8).toLowerCase() === "md5-sess") {
                result2 = input.substr(pos, 8);
                pos += 8;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"MD5-sess\"");
                }
              }
              if (result2 === null) {
                result2 = parse_token();
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, algorithm) {
                              data.algorithm=algorithm.toUpperCase(); })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_qop_options() {
        var result0, result1, result2, result3, result4, result5, result6;
        var pos0, pos1, pos2;
        pos0 = pos;
        if (input.substr(pos, 3).toLowerCase() === "qop") {
          result0 = input.substr(pos, 3);
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"qop\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_LDQUOT();
            if (result2 !== null) {
              pos1 = pos;
              result3 = parse_qop_value();
              if (result3 !== null) {
                result4 = [];
                pos2 = pos;
                if (input.charCodeAt(pos) === 44) {
                  result5 = ",";
                  pos++;
                } else {
                  result5 = null;
                  if (reportFailures === 0) {
                    matchFailed("\",\"");
                  }
                }
                if (result5 !== null) {
                  result6 = parse_qop_value();
                  if (result6 !== null) {
                    result5 = [result5, result6];
                  } else {
                    result5 = null;
                    pos = pos2;
                  }
                } else {
                  result5 = null;
                  pos = pos2;
                }
                while (result5 !== null) {
                  result4.push(result5);
                  pos2 = pos;
                  if (input.charCodeAt(pos) === 44) {
                    result5 = ",";
                    pos++;
                  } else {
                    result5 = null;
                    if (reportFailures === 0) {
                      matchFailed("\",\"");
                    }
                  }
                  if (result5 !== null) {
                    result6 = parse_qop_value();
                    if (result6 !== null) {
                      result5 = [result5, result6];
                    } else {
                      result5 = null;
                      pos = pos2;
                    }
                  } else {
                    result5 = null;
                    pos = pos2;
                  }
                }
                if (result4 !== null) {
                  result3 = [result3, result4];
                } else {
                  result3 = null;
                  pos = pos1;
                }
              } else {
                result3 = null;
                pos = pos1;
              }
              if (result3 !== null) {
                result4 = parse_RDQUOT();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos0;
                }
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_qop_value() {
        var result0;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 8).toLowerCase() === "auth-int") {
          result0 = input.substr(pos, 8);
          pos += 8;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"auth-int\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 4).toLowerCase() === "auth") {
            result0 = input.substr(pos, 4);
            pos += 4;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"auth\"");
            }
          }
          if (result0 === null) {
            result0 = parse_token();
          }
        }
        if (result0 !== null) {
          result0 = (function(offset, qop_value) {
                                data.qop || (data.qop=[]);
                                data.qop.push(qop_value.toLowerCase()); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Proxy_Require() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_COMMA();
          if (result2 !== null) {
            result3 = parse_token();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_COMMA();
            if (result2 !== null) {
              result3 = parse_token();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Record_Route() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_rec_route();
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = parse_COMMA();
          if (result2 !== null) {
            result3 = parse_rec_route();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = parse_COMMA();
            if (result2 !== null) {
              result3 = parse_rec_route();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          var idx, length;
                          length = data.multi_header.length;
                          for (idx = 0; idx < length; idx++) {
                            if (data.multi_header[idx].parsed === null) {
                              data = null;
                              break;
                            }
                          }
                          if (data !== null) {
                            data = data.multi_header;
                          } else {
                            data = -1;
                          }})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_rec_route() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_name_addr();
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_generic_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_generic_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          var header;
                          if(!data.multi_header) data.multi_header = [];
                          try {
                            header = new NameAddrHeader(data.uri, data.display_name, data.params);
                            delete data.uri;
                            delete data.display_name;
                            delete data.params;
                          } catch(e) {
                            header = null;
                          }
                          data.multi_header.push( { 'possition': pos,
                                                    'offset': offset,
                                                    'parsed': header
                                                  });})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Reason() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 3).toLowerCase() === "sip") {
          result0 = input.substr(pos, 3);
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"SIP\"");
          }
        }
        if (result0 === null) {
          result0 = parse_token();
        }
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_reason_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_reason_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, protocol) {
                          data.protocol = protocol.toLowerCase();
                          if (!data.params) data.params = {};
                          if (data.params.text && data.params.text[0] === '"') {
                            var text = data.params.text;
                            data.text = text.substring(1, text.length-1);
                            delete data.params.text;
                          }
                        })(pos0, result0[0]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_reason_param() {
        var result0;
        result0 = parse_reason_cause();
        if (result0 === null) {
          result0 = parse_generic_param();
        }
        return result0;
      }
      function parse_reason_cause() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 5).toLowerCase() === "cause") {
          result0 = input.substr(pos, 5);
          pos += 5;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"cause\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result3 = parse_DIGIT();
            if (result3 !== null) {
              result2 = [];
              while (result3 !== null) {
                result2.push(result3);
                result3 = parse_DIGIT();
              }
            } else {
              result2 = null;
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, cause) {
                          data.cause = parseInt(cause.join(''));
                        })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Require() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_COMMA();
          if (result2 !== null) {
            result3 = parse_token();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_COMMA();
            if (result2 !== null) {
              result3 = parse_token();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Route() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_route_param();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_COMMA();
          if (result2 !== null) {
            result3 = parse_route_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_COMMA();
            if (result2 !== null) {
              result3 = parse_route_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_route_param() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_name_addr();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_generic_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_generic_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Subscription_State() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_substate_value();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_subexp_params();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_subexp_params();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_substate_value() {
        var result0;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 6).toLowerCase() === "active") {
          result0 = input.substr(pos, 6);
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"active\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 7).toLowerCase() === "pending") {
            result0 = input.substr(pos, 7);
            pos += 7;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"pending\"");
            }
          }
          if (result0 === null) {
            if (input.substr(pos, 10).toLowerCase() === "terminated") {
              result0 = input.substr(pos, 10);
              pos += 10;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"terminated\"");
              }
            }
            if (result0 === null) {
              result0 = parse_token();
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                                data.state = input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_subexp_params() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 6).toLowerCase() === "reason") {
          result0 = input.substr(pos, 6);
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"reason\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_event_reason_value();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, reason) {
                                if (typeof reason !== 'undefined') data.reason = reason; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        if (result0 === null) {
          pos0 = pos;
          pos1 = pos;
          if (input.substr(pos, 7).toLowerCase() === "expires") {
            result0 = input.substr(pos, 7);
            pos += 7;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"expires\"");
            }
          }
          if (result0 !== null) {
            result1 = parse_EQUAL();
            if (result1 !== null) {
              result2 = parse_delta_seconds();
              if (result2 !== null) {
                result0 = [result0, result1, result2];
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, expires) {
                                  if (typeof expires !== 'undefined') data.expires = expires; })(pos0, result0[2]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          if (result0 === null) {
            pos0 = pos;
            pos1 = pos;
            if (input.substr(pos, 11).toLowerCase() === "retry_after") {
              result0 = input.substr(pos, 11);
              pos += 11;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"retry_after\"");
              }
            }
            if (result0 !== null) {
              result1 = parse_EQUAL();
              if (result1 !== null) {
                result2 = parse_delta_seconds();
                if (result2 !== null) {
                  result0 = [result0, result1, result2];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
            if (result0 !== null) {
              result0 = (function(offset, retry_after) {
                                    if (typeof retry_after !== 'undefined') data.retry_after = retry_after; })(pos0, result0[2]);
            }
            if (result0 === null) {
              pos = pos0;
            }
            if (result0 === null) {
              result0 = parse_generic_param();
            }
          }
        }
        return result0;
      }
      function parse_event_reason_value() {
        var result0;
        if (input.substr(pos, 11).toLowerCase() === "deactivated") {
          result0 = input.substr(pos, 11);
          pos += 11;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"deactivated\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 9).toLowerCase() === "probation") {
            result0 = input.substr(pos, 9);
            pos += 9;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"probation\"");
            }
          }
          if (result0 === null) {
            if (input.substr(pos, 8).toLowerCase() === "rejected") {
              result0 = input.substr(pos, 8);
              pos += 8;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"rejected\"");
              }
            }
            if (result0 === null) {
              if (input.substr(pos, 7).toLowerCase() === "timeout") {
                result0 = input.substr(pos, 7);
                pos += 7;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"timeout\"");
                }
              }
              if (result0 === null) {
                if (input.substr(pos, 6).toLowerCase() === "giveup") {
                  result0 = input.substr(pos, 6);
                  pos += 6;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"giveup\"");
                  }
                }
                if (result0 === null) {
                  if (input.substr(pos, 10).toLowerCase() === "noresource") {
                    result0 = input.substr(pos, 10);
                    pos += 10;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"noresource\"");
                    }
                  }
                  if (result0 === null) {
                    if (input.substr(pos, 9).toLowerCase() === "invariant") {
                      result0 = input.substr(pos, 9);
                      pos += 9;
                    } else {
                      result0 = null;
                      if (reportFailures === 0) {
                        matchFailed("\"invariant\"");
                      }
                    }
                    if (result0 === null) {
                      result0 = parse_token();
                    }
                  }
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_Subject() {
        var result0;
        result0 = parse_TEXT_UTF8_TRIM();
        result0 = result0 !== null ? result0 : "";
        return result0;
      }
      function parse_Supported() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_COMMA();
          if (result2 !== null) {
            result3 = parse_token();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_COMMA();
            if (result2 !== null) {
              result3 = parse_token();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        result0 = result0 !== null ? result0 : "";
        return result0;
      }
      function parse_To() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SIP_URI_noparams();
        if (result0 === null) {
          result0 = parse_name_addr();
        }
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_to_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_to_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                      var tag = data.tag;
                      try {
                        data = new NameAddrHeader(data.uri, data.display_name, data.params);
                        if (tag) {data.setParam('tag',tag)}
                      } catch(e) {
                        data = -1;
                      }})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_to_param() {
        var result0;
        result0 = parse_tag_param();
        if (result0 === null) {
          result0 = parse_generic_param();
        }
        return result0;
      }
      function parse_Via() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_via_param();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_COMMA();
          if (result2 !== null) {
            result3 = parse_via_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_COMMA();
            if (result2 !== null) {
              result3 = parse_via_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_via_param() {
        var result0, result1, result2, result3, result4, result5;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_sent_protocol();
        if (result0 !== null) {
          result1 = parse_LWS();
          if (result1 !== null) {
            result2 = parse_sent_by();
            if (result2 !== null) {
              result3 = [];
              pos1 = pos;
              result4 = parse_SEMI();
              if (result4 !== null) {
                result5 = parse_via_params();
                if (result5 !== null) {
                  result4 = [result4, result5];
                } else {
                  result4 = null;
                  pos = pos1;
                }
              } else {
                result4 = null;
                pos = pos1;
              }
              while (result4 !== null) {
                result3.push(result4);
                pos1 = pos;
                result4 = parse_SEMI();
                if (result4 !== null) {
                  result5 = parse_via_params();
                  if (result5 !== null) {
                    result4 = [result4, result5];
                  } else {
                    result4 = null;
                    pos = pos1;
                  }
                } else {
                  result4 = null;
                  pos = pos1;
                }
              }
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_via_params() {
        var result0;
        result0 = parse_via_ttl();
        if (result0 === null) {
          result0 = parse_via_maddr();
          if (result0 === null) {
            result0 = parse_via_received();
            if (result0 === null) {
              result0 = parse_via_branch();
              if (result0 === null) {
                result0 = parse_response_port();
                if (result0 === null) {
                  result0 = parse_generic_param();
                }
              }
            }
          }
        }
        return result0;
      }
      function parse_via_ttl() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 3).toLowerCase() === "ttl") {
          result0 = input.substr(pos, 3);
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"ttl\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_ttl();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, via_ttl_value) {
                              data.ttl = via_ttl_value; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_via_maddr() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 5).toLowerCase() === "maddr") {
          result0 = input.substr(pos, 5);
          pos += 5;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"maddr\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_host();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, via_maddr) {
                              data.maddr = via_maddr; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_via_received() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 8).toLowerCase() === "received") {
          result0 = input.substr(pos, 8);
          pos += 8;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"received\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_IPv4address();
            if (result2 === null) {
              result2 = parse_IPv6address();
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, via_received) {
                              data.received = via_received; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_via_branch() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 6).toLowerCase() === "branch") {
          result0 = input.substr(pos, 6);
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"branch\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_token();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, via_branch) {
                              data.branch = via_branch; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_response_port() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 5).toLowerCase() === "rport") {
          result0 = input.substr(pos, 5);
          pos += 5;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"rport\"");
          }
        }
        if (result0 !== null) {
          pos2 = pos;
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = [];
            result3 = parse_DIGIT();
            while (result3 !== null) {
              result2.push(result3);
              result3 = parse_DIGIT();
            }
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos2;
            }
          } else {
            result1 = null;
            pos = pos2;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                              if(typeof response_port !== 'undefined')
                                data.rport = response_port.join(''); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_sent_protocol() {
        var result0, result1, result2, result3, result4;
        var pos0;
        pos0 = pos;
        result0 = parse_protocol_name();
        if (result0 !== null) {
          result1 = parse_SLASH();
          if (result1 !== null) {
            result2 = parse_token();
            if (result2 !== null) {
              result3 = parse_SLASH();
              if (result3 !== null) {
                result4 = parse_transport();
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos0;
                }
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_protocol_name() {
        var result0;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 3).toLowerCase() === "sip") {
          result0 = input.substr(pos, 3);
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"SIP\"");
          }
        }
        if (result0 === null) {
          result0 = parse_token();
        }
        if (result0 !== null) {
          result0 = (function(offset, via_protocol) {
                              data.protocol = via_protocol; })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_transport() {
        var result0;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 3).toLowerCase() === "udp") {
          result0 = input.substr(pos, 3);
          pos += 3;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"UDP\"");
          }
        }
        if (result0 === null) {
          if (input.substr(pos, 3).toLowerCase() === "tcp") {
            result0 = input.substr(pos, 3);
            pos += 3;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"TCP\"");
            }
          }
          if (result0 === null) {
            if (input.substr(pos, 3).toLowerCase() === "tls") {
              result0 = input.substr(pos, 3);
              pos += 3;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"TLS\"");
              }
            }
            if (result0 === null) {
              if (input.substr(pos, 4).toLowerCase() === "sctp") {
                result0 = input.substr(pos, 4);
                pos += 4;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"SCTP\"");
                }
              }
              if (result0 === null) {
                result0 = parse_token();
              }
            }
          }
        }
        if (result0 !== null) {
          result0 = (function(offset, via_transport) {
                              data.transport = via_transport; })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_sent_by() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_via_host();
        if (result0 !== null) {
          pos1 = pos;
          result1 = parse_COLON();
          if (result1 !== null) {
            result2 = parse_via_port();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos1;
            }
          } else {
            result1 = null;
            pos = pos1;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_via_host() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_IPv4address();
        if (result0 === null) {
          result0 = parse_IPv6reference();
          if (result0 === null) {
            result0 = parse_hostname();
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                              data.host = input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_via_port() {
        var result0, result1, result2, result3, result4;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_DIGIT();
        result0 = result0 !== null ? result0 : "";
        if (result0 !== null) {
          result1 = parse_DIGIT();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result2 = parse_DIGIT();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result3 = parse_DIGIT();
              result3 = result3 !== null ? result3 : "";
              if (result3 !== null) {
                result4 = parse_DIGIT();
                result4 = result4 !== null ? result4 : "";
                if (result4 !== null) {
                  result0 = [result0, result1, result2, result3, result4];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, via_sent_by_port) {
                              data.port = parseInt(via_sent_by_port.join('')); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_ttl() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_DIGIT();
        if (result0 !== null) {
          result1 = parse_DIGIT();
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result2 = parse_DIGIT();
            result2 = result2 !== null ? result2 : "";
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, ttl) {
                              return parseInt(ttl.join('')); })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_WWW_Authenticate() {
        var result0;
        result0 = parse_challenge();
        return result0;
      }
      function parse_Session_Expires() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_s_e_expires();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_s_e_params();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_s_e_params();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_s_e_expires() {
        var result0;
        var pos0;
        pos0 = pos;
        result0 = parse_delta_seconds();
        if (result0 !== null) {
          result0 = (function(offset, expires) { data.expires = expires; })(pos0, result0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_s_e_params() {
        var result0;
        result0 = parse_s_e_refresher();
        if (result0 === null) {
          result0 = parse_generic_param();
        }
        return result0;
      }
      function parse_s_e_refresher() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 9).toLowerCase() === "refresher") {
          result0 = input.substr(pos, 9);
          pos += 9;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"refresher\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            if (input.substr(pos, 3).toLowerCase() === "uac") {
              result2 = input.substr(pos, 3);
              pos += 3;
            } else {
              result2 = null;
              if (reportFailures === 0) {
                matchFailed("\"uac\"");
              }
            }
            if (result2 === null) {
              if (input.substr(pos, 3).toLowerCase() === "uas") {
                result2 = input.substr(pos, 3);
                pos += 3;
              } else {
                result2 = null;
                if (reportFailures === 0) {
                  matchFailed("\"uas\"");
                }
              }
            }
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, s_e_refresher_value) { data.refresher = s_e_refresher_value.toLowerCase(); })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_extension_header() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_token();
        if (result0 !== null) {
          result1 = parse_HCOLON();
          if (result1 !== null) {
            result2 = parse_header_value();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_header_value() {
        var result0, result1;
        result0 = [];
        result1 = parse_TEXT_UTF8char();
        if (result1 === null) {
          result1 = parse_UTF8_CONT();
          if (result1 === null) {
            result1 = parse_LWS();
          }
        }
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_TEXT_UTF8char();
          if (result1 === null) {
            result1 = parse_UTF8_CONT();
            if (result1 === null) {
              result1 = parse_LWS();
            }
          }
        }
        return result0;
      }
      function parse_message_body() {
        var result0, result1;
        result0 = [];
        result1 = parse_OCTET();
        while (result1 !== null) {
          result0.push(result1);
          result1 = parse_OCTET();
        }
        return result0;
      }
      function parse_uuid_URI() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 5) === "uuid:") {
          result0 = "uuid:";
          pos += 5;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"uuid:\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_uuid();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_uuid() {
        var result0, result1, result2, result3, result4, result5, result6, result7, result8;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_hex8();
        if (result0 !== null) {
          if (input.charCodeAt(pos) === 45) {
            result1 = "-";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"-\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_hex4();
            if (result2 !== null) {
              if (input.charCodeAt(pos) === 45) {
                result3 = "-";
                pos++;
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("\"-\"");
                }
              }
              if (result3 !== null) {
                result4 = parse_hex4();
                if (result4 !== null) {
                  if (input.charCodeAt(pos) === 45) {
                    result5 = "-";
                    pos++;
                  } else {
                    result5 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"-\"");
                    }
                  }
                  if (result5 !== null) {
                    result6 = parse_hex4();
                    if (result6 !== null) {
                      if (input.charCodeAt(pos) === 45) {
                        result7 = "-";
                        pos++;
                      } else {
                        result7 = null;
                        if (reportFailures === 0) {
                          matchFailed("\"-\"");
                        }
                      }
                      if (result7 !== null) {
                        result8 = parse_hex12();
                        if (result8 !== null) {
                          result0 = [result0, result1, result2, result3, result4, result5, result6, result7, result8];
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, uuid) {
                          data = input.substring(pos+5, offset); })(pos0, result0[0]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_hex4() {
        var result0, result1, result2, result3;
        var pos0;
        pos0 = pos;
        result0 = parse_HEXDIG();
        if (result0 !== null) {
          result1 = parse_HEXDIG();
          if (result1 !== null) {
            result2 = parse_HEXDIG();
            if (result2 !== null) {
              result3 = parse_HEXDIG();
              if (result3 !== null) {
                result0 = [result0, result1, result2, result3];
              } else {
                result0 = null;
                pos = pos0;
              }
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_hex8() {
        var result0, result1;
        var pos0;
        pos0 = pos;
        result0 = parse_hex4();
        if (result0 !== null) {
          result1 = parse_hex4();
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_hex12() {
        var result0, result1, result2;
        var pos0;
        pos0 = pos;
        result0 = parse_hex4();
        if (result0 !== null) {
          result1 = parse_hex4();
          if (result1 !== null) {
            result2 = parse_hex4();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos0;
            }
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_Refer_To() {
        var result0, result1, result2, result3;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_SIP_URI_noparams();
        if (result0 === null) {
          result0 = parse_name_addr();
        }
        if (result0 !== null) {
          result1 = [];
          pos2 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_generic_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos2;
            }
          } else {
            result2 = null;
            pos = pos2;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos2 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_generic_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                        try {
                          data = new NameAddrHeader(data.uri, data.display_name, data.params);
                        } catch(e) {
                          data = -1;
                        }})(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_Replaces() {
        var result0, result1, result2, result3;
        var pos0, pos1;
        pos0 = pos;
        result0 = parse_call_id();
        if (result0 !== null) {
          result1 = [];
          pos1 = pos;
          result2 = parse_SEMI();
          if (result2 !== null) {
            result3 = parse_replaces_param();
            if (result3 !== null) {
              result2 = [result2, result3];
            } else {
              result2 = null;
              pos = pos1;
            }
          } else {
            result2 = null;
            pos = pos1;
          }
          while (result2 !== null) {
            result1.push(result2);
            pos1 = pos;
            result2 = parse_SEMI();
            if (result2 !== null) {
              result3 = parse_replaces_param();
              if (result3 !== null) {
                result2 = [result2, result3];
              } else {
                result2 = null;
                pos = pos1;
              }
            } else {
              result2 = null;
              pos = pos1;
            }
          }
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos0;
          }
        } else {
          result0 = null;
          pos = pos0;
        }
        return result0;
      }
      function parse_call_id() {
        var result0, result1, result2;
        var pos0, pos1, pos2;
        pos0 = pos;
        pos1 = pos;
        result0 = parse_word();
        if (result0 !== null) {
          pos2 = pos;
          if (input.charCodeAt(pos) === 64) {
            result1 = "@";
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("\"@\"");
            }
          }
          if (result1 !== null) {
            result2 = parse_word();
            if (result2 !== null) {
              result1 = [result1, result2];
            } else {
              result1 = null;
              pos = pos2;
            }
          } else {
            result1 = null;
            pos = pos2;
          }
          result1 = result1 !== null ? result1 : "";
          if (result1 !== null) {
            result0 = [result0, result1];
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                          data.call_id = input.substring(pos, offset); })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_replaces_param() {
        var result0;
        result0 = parse_to_tag();
        if (result0 === null) {
          result0 = parse_from_tag();
          if (result0 === null) {
            result0 = parse_early_flag();
            if (result0 === null) {
              result0 = parse_generic_param();
            }
          }
        }
        return result0;
      }
      function parse_to_tag() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 6) === "to-tag") {
          result0 = "to-tag";
          pos += 6;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"to-tag\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_token();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, to_tag) {
                            data.to_tag = to_tag; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_from_tag() {
        var result0, result1, result2;
        var pos0, pos1;
        pos0 = pos;
        pos1 = pos;
        if (input.substr(pos, 8) === "from-tag") {
          result0 = "from-tag";
          pos += 8;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"from-tag\"");
          }
        }
        if (result0 !== null) {
          result1 = parse_EQUAL();
          if (result1 !== null) {
            result2 = parse_token();
            if (result2 !== null) {
              result0 = [result0, result1, result2];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
        } else {
          result0 = null;
          pos = pos1;
        }
        if (result0 !== null) {
          result0 = (function(offset, from_tag) {
                            data.from_tag = from_tag; })(pos0, result0[2]);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function parse_early_flag() {
        var result0;
        var pos0;
        pos0 = pos;
        if (input.substr(pos, 10) === "early-only") {
          result0 = "early-only";
          pos += 10;
        } else {
          result0 = null;
          if (reportFailures === 0) {
            matchFailed("\"early-only\"");
          }
        }
        if (result0 !== null) {
          result0 = (function(offset) {
                            data.early_only = true; })(pos0);
        }
        if (result0 === null) {
          pos = pos0;
        }
        return result0;
      }
      function cleanupExpected(expected) {
        expected.sort();
        var lastExpected = null;
        var cleanExpected = [];
        for (var i = 0; i < expected.length; i++) {
          if (expected[i] !== lastExpected) {
            cleanExpected.push(expected[i]);
            lastExpected = expected[i];
          }
        }
        return cleanExpected;
      }
      function computeErrorPosition() {
        /*
         * The first idea was to use |String.split| to break the input up to the
         * error position along newlines and derive the line and column from
         * there. However IE's |split| implementation is so broken that it was
         * enough to prevent it.
         */
        var line = 1;
        var column = 1;
        var seenCR = false;
        for (var i = 0; i < Math.max(pos, rightmostFailuresPos); i++) {
          var ch = input.charAt(i);
          if (ch === "\n") {
            if (!seenCR) { line++; }
            column = 1;
            seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            line++;
            column = 1;
            seenCR = true;
          } else {
            column++;
            seenCR = false;
          }
        }
        return { line: line, column: column };
      }
        var URI = require('./URI');
        var NameAddrHeader = require('./NameAddrHeader');
        var data = {};
      var result = parseFunctions[startRule]();
      /*
       * The parser is now in one of the following three states:
       *
       * 1. The parser successfully parsed the whole input.
       *
       *    - |result !== null|
       *    - |pos === input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 2. The parser successfully parsed only a part of the input.
       *
       *    - |result !== null|
       *    - |pos < input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 3. The parser did not successfully parse any part of the input.
       *
       *   - |result === null|
       *   - |pos === 0|
       *   - |rightmostFailuresExpected| contains at least one failure
       *
       * All code following this comment (including called functions) must
       * handle these states.
       */
      if (result === null || pos !== input.length) {
        var offset = Math.max(pos, rightmostFailuresPos);
        var found = offset < input.length ? input.charAt(offset) : null;
        var errorPosition = computeErrorPosition();
        new this.SyntaxError(
          cleanupExpected(rightmostFailuresExpected),
          found,
          offset,
          errorPosition.line,
          errorPosition.column
        );
        return -1;
      }
      return data;
    },
    /* Returns the parser source code. */
    toSource: function() { return this._source; }
  };
  /* Thrown when a parser encounters a syntax error. */
  result.SyntaxError = function(expected, found, offset, line, column) {
    function buildMessage(expected, found) {
      var expectedHumanized, foundHumanized;
      switch (expected.length) {
        case 0:
          expectedHumanized = "end of input";
          break;
        case 1:
          expectedHumanized = expected[0];
          break;
        default:
          expectedHumanized = expected.slice(0, expected.length - 1).join(", ")
            + " or "
            + expected[expected.length - 1];
      }
      foundHumanized = found ? quote(found) : "end of input";
      return "Expected " + expectedHumanized + " but " + foundHumanized + " found.";
    }
    this.name = "SyntaxError";
    this.expected = expected;
    this.found = found;
    this.message = buildMessage(expected, found);
    this.offset = offset;
    this.line = line;
    this.column = column;
  };
  result.SyntaxError.prototype = Error.prototype;
  return result;
})();
},{"./NameAddrHeader":43,"./URI":58}],41:[function(require,module,exports){
/**
 * Dependencies.
 */
var debug = require('debug')('PlivoSIP');
var adapter = require('webrtc-adapter');
var pkg = require('../package.json');

debug('version %s', pkg.version);

var C = require('./Constants');
var Exceptions = require('./Exceptions');
var Utils = require('./Utils');
var UA = require('./UA');
var URI = require('./URI');
var NameAddrHeader = require('./NameAddrHeader');
var Grammar = require('./Grammar');
var WebSocketInterface = require('./WebSocketInterface');


/**
 * Expose the JsSIP module.
 */
var JsSIP = module.exports = {
  C: C,
  Exceptions: Exceptions,
  Utils: Utils,
  UA: UA,
  URI: URI,
  NameAddrHeader: NameAddrHeader,
  WebSocketInterface: WebSocketInterface,
  Grammar: Grammar,
  // Expose the debug module.
  debug: require('debug'),
  // Expose the adapter module.
  adapter: adapter
};


Object.defineProperties(JsSIP, {
  name: {
    get: function() { return pkg.title; }
  },

  version: {
    get: function() { return pkg.version; }
  }
});

},{"../package.json":34,"./Constants":35,"./Exceptions":39,"./Grammar":40,"./NameAddrHeader":43,"./UA":57,"./URI":58,"./Utils":59,"./WebSocketInterface":60,"debug":11,"webrtc-adapter":24}],42:[function(require,module,exports){
module.exports = Message;


/**
 * Dependencies.
 */
var util = require('util');
var events = require('events');
var JsSIP_C = require('./Constants');
var SIPMessage = require('./SIPMessage');
var Utils = require('./Utils');
var RequestSender = require('./RequestSender');
var Transactions = require('./Transactions');
var Exceptions = require('./Exceptions');


function Message(ua) {
  this.ua = ua;

  // Custom message empty object for high level use
  this.data = {};

  events.EventEmitter.call(this);
}

util.inherits(Message, events.EventEmitter);


Message.prototype.send = function(target, body, options) {
  var request_sender, event, contentType, eventHandlers, extraHeaders,
    originalTarget = target;

  if (target === undefined || body === undefined) {
    throw new TypeError('Not enough arguments');
  }

  // Check target validity
  target = this.ua.normalizeTarget(target);
  if (!target) {
    throw new TypeError('Invalid target: '+ originalTarget);
  }

  // Get call options
  options = options || {};
  extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [];
  eventHandlers = options.eventHandlers || {};
  contentType = options.contentType || 'text/plain';

  this.content_type = contentType;

  // Set event handlers
  for (event in eventHandlers) {
    this.on(event, eventHandlers[event]);
  }

  this.closed = false;
  this.ua.applicants[this] = this;

  extraHeaders.push('Content-Type: '+ contentType);

  this.request = new SIPMessage.OutgoingRequest(JsSIP_C.MESSAGE, target, this.ua, null, extraHeaders);

  if(body) {
    this.request.body = body;
    this.content = body;
  } else {
    this.content = null;
  }

  request_sender = new RequestSender(this, this.ua);

  this.newMessage('local', this.request);

  request_sender.send();
};

Message.prototype.receiveResponse = function(response) {
  var cause;

  if(this.closed) {
    return;
  }
  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      // Ignore provisional responses.
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      delete this.ua.applicants[this];
      this.emit('succeeded', {
        originator: 'remote',
        response: response
      });
      break;

    default:
      delete this.ua.applicants[this];
      cause = Utils.sipErrorCause(response.status_code);
      this.emit('failed', {
        originator: 'remote',
        response: response,
        cause: cause
      });
      break;
  }
};


Message.prototype.onRequestTimeout = function() {
  if(this.closed) {
    return;
  }
  this.emit('failed', {
    originator: 'system',
    cause: JsSIP_C.causes.REQUEST_TIMEOUT
  });
};

Message.prototype.onTransportError = function() {
  if(this.closed) {
    return;
  }
  this.emit('failed', {
    originator: 'system',
    cause: JsSIP_C.causes.CONNECTION_ERROR
  });
};

Message.prototype.close = function() {
  this.closed = true;
  delete this.ua.applicants[this];
};

Message.prototype.init_incoming = function(request) {
  var transaction;

  this.request = request;
  this.content_type = request.getHeader('Content-Type');

  if (request.body) {
    this.content = request.body;
  } else {
    this.content = null;
  }

  this.newMessage('remote', request);

  transaction = this.ua.transactions.nist[request.via_branch];

  if (transaction && (transaction.state === Transactions.C.STATUS_TRYING || transaction.state === Transactions.C.STATUS_PROCEEDING)) {
    request.reply(200);
  }
};

/**
 * Accept the incoming Message
 * Only valid for incoming Messages
 */
Message.prototype.accept = function(options) {
  options = options || {};

  var
    extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [],
    body = options.body;

  if (this.direction !== 'incoming') {
    throw new Exceptions.NotSupportedError('"accept" not supported for outgoing Message');
  }

  this.request.reply(200, null, extraHeaders, body);
};

/**
 * Reject the incoming Message
 * Only valid for incoming Messages
 */
Message.prototype.reject = function(options) {
  options = options || {};

  var
    status_code = options.status_code || 480,
    reason_phrase = options.reason_phrase,
    extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [],
    body = options.body;

  if (this.direction !== 'incoming') {
    throw new Exceptions.NotSupportedError('"reject" not supported for outgoing Message');
  }

  if (status_code < 300 || status_code >= 700) {
    throw new TypeError('Invalid status_code: '+ status_code);
  }

  this.request.reply(status_code, reason_phrase, extraHeaders, body);
};

/**
 * Internal Callbacks
 */

Message.prototype.newMessage = function(originator, request) {
  if (originator === 'remote') {
    this.direction = 'incoming';
    this.local_identity = request.to;
    this.remote_identity = request.from;
  } else if (originator === 'local'){
    this.direction = 'outgoing';
    this.local_identity = request.from;
    this.remote_identity = request.to;
  }

  this.ua.newMessage({
    originator: originator,
    message: this,
    request: request
  });
};

},{"./Constants":35,"./Exceptions":39,"./RequestSender":51,"./SIPMessage":52,"./Transactions":55,"./Utils":59,"events":13,"util":23}],43:[function(require,module,exports){
module.exports = NameAddrHeader;


/**
 * Dependencies.
 */
var URI = require('./URI');
var Grammar = require('./Grammar');


function NameAddrHeader(uri, display_name, parameters) {
  var param;

  // Checks
  if(!uri || !(uri instanceof URI)) {
    throw new TypeError('missing or invalid "uri" parameter');
  }

  // Initialize parameters
  this.uri = uri;
  this.parameters = {};

  for (param in parameters) {
    this.setParam(param, parameters[param]);
  }

  Object.defineProperties(this, {
    display_name: {
      get: function() { return display_name; },
      set: function(value) {
        display_name = (value === 0) ? '0' : value;
      }
    }
  });
}

NameAddrHeader.prototype = {
  setParam: function(key, value) {
    if (key) {
      this.parameters[key.toLowerCase()] = (typeof value === 'undefined' || value === null) ? null : value.toString();
    }
  },

  getParam: function(key) {
    if(key) {
      return this.parameters[key.toLowerCase()];
    }
  },

  hasParam: function(key) {
    if(key) {
      return (this.parameters.hasOwnProperty(key.toLowerCase()) && true) || false;
    }
  },

  deleteParam: function(parameter) {
    var value;
    parameter = parameter.toLowerCase();
    if (this.parameters.hasOwnProperty(parameter)) {
      value = this.parameters[parameter];
      delete this.parameters[parameter];
      return value;
    }
  },

  clearParams: function() {
    this.parameters = {};
  },

  clone: function() {
    return new NameAddrHeader(
      this.uri.clone(),
      this.display_name,
      JSON.parse(JSON.stringify(this.parameters)));
  },

  toString: function() {
    var body, parameter;

    body  = (this.display_name || this.display_name === 0) ? '"' + this.display_name + '" ' : '';
    body += '<' + this.uri.toString() + '>';

    for (parameter in this.parameters) {
      body += ';' + parameter;

      if (this.parameters[parameter] !== null) {
        body += '='+ this.parameters[parameter];
      }
    }

    return body;
  }
};


/**
  * Parse the given string and returns a NameAddrHeader instance or undefined if
  * it is an invalid NameAddrHeader.
  */
NameAddrHeader.parse = function(name_addr_header) {
  name_addr_header = Grammar.parse(name_addr_header,'Name_Addr_Header');

  if (name_addr_header !== -1) {
    return name_addr_header;
  } else {
    return undefined;
  }
};

},{"./Grammar":40,"./URI":58}],44:[function(require,module,exports){
var Parser = {};

module.exports = Parser;


/**
 * Dependencies.
 */
var debugerror = require('debug')('PlivoSIP:ERROR:Parser');
debugerror.log = console.warn.bind(console);
var Grammar = require('./Grammar');
var SIPMessage = require('./SIPMessage');


/**
 * Extract and parse every header of a SIP message.
 */
function getHeader(data, headerStart) {
  var
    // 'start' position of the header.
    start = headerStart,
    // 'end' position of the header.
    end = 0,
    // 'partial end' position of the header.
    partialEnd = 0;

  //End of message.
  if (data.substring(start, start + 2).match(/(^\r\n)/)) {
    return -2;
  }

  while(end === 0) {
    // Partial End of Header.
    partialEnd = data.indexOf('\r\n', start);

    // 'indexOf' returns -1 if the value to be found never occurs.
    if (partialEnd === -1) {
      return partialEnd;
    }

    if(!data.substring(partialEnd + 2, partialEnd + 4).match(/(^\r\n)/) && data.charAt(partialEnd + 2).match(/(^\s+)/)) {
      // Not the end of the message. Continue from the next position.
      start = partialEnd + 2;
    } else {
      end = partialEnd;
    }
  }

  return end;
}

function parseHeader(message, data, headerStart, headerEnd) {
  var header, idx, length, parsed,
    hcolonIndex = data.indexOf(':', headerStart),
    headerName = data.substring(headerStart, hcolonIndex).trim(),
    headerValue = data.substring(hcolonIndex + 1, headerEnd).trim();

  // If header-field is well-known, parse it.
  switch(headerName.toLowerCase()) {
    case 'via':
    case 'v':
      message.addHeader('via', headerValue);
      if(message.getHeaders('via').length === 1) {
        parsed = message.parseHeader('Via');
        if(parsed) {
          message.via = parsed;
          message.via_branch = parsed.branch;
        }
      } else {
        parsed = 0;
      }
      break;
    case 'from':
    case 'f':
      message.setHeader('from', headerValue);
      parsed = message.parseHeader('from');
      if(parsed) {
        message.from = parsed;
        message.from_tag = parsed.getParam('tag');
      }
      break;
    case 'to':
    case 't':
      message.setHeader('to', headerValue);
      parsed = message.parseHeader('to');
      if(parsed) {
        message.to = parsed;
        message.to_tag = parsed.getParam('tag');
      }
      break;
    case 'record-route':
      parsed = Grammar.parse(headerValue, 'Record_Route');

      if (parsed === -1) {
        parsed = undefined;
      } else {
        length = parsed.length;
        for (idx = 0; idx < length; idx++) {
          header = parsed[idx];
          message.addHeader('record-route', headerValue.substring(header.possition, header.offset));
          message.headers['Record-Route'][message.getHeaders('record-route').length - 1].parsed = header.parsed;
        }
      }
      break;
    case 'call-id':
    case 'i':
      message.setHeader('call-id', headerValue);
      parsed = message.parseHeader('call-id');
      if(parsed) {
        message.call_id = headerValue;
      }
      break;
    case 'contact':
    case 'm':
      parsed = Grammar.parse(headerValue, 'Contact');

      if (parsed === -1) {
        parsed = undefined;
      } else {
        length = parsed.length;
        for (idx = 0; idx < length; idx++) {
          header = parsed[idx];
          message.addHeader('contact', headerValue.substring(header.possition, header.offset));
          message.headers.Contact[message.getHeaders('contact').length - 1].parsed = header.parsed;
        }
      }
      break;
    case 'content-length':
    case 'l':
      message.setHeader('content-length', headerValue);
      parsed = message.parseHeader('content-length');
      break;
    case 'content-type':
    case 'c':
      message.setHeader('content-type', headerValue);
      parsed = message.parseHeader('content-type');
      break;
    case 'cseq':
      message.setHeader('cseq', headerValue);
      parsed = message.parseHeader('cseq');
      if(parsed) {
        message.cseq = parsed.value;
      }
      if(message instanceof SIPMessage.IncomingResponse) {
        message.method = parsed.method;
      }
      break;
    case 'max-forwards':
      message.setHeader('max-forwards', headerValue);
      parsed = message.parseHeader('max-forwards');
      break;
    case 'www-authenticate':
      message.setHeader('www-authenticate', headerValue);
      parsed = message.parseHeader('www-authenticate');
      break;
    case 'proxy-authenticate':
      message.setHeader('proxy-authenticate', headerValue);
      parsed = message.parseHeader('proxy-authenticate');
      break;
    case 'session-expires':
    case 'x':
      message.setHeader('session-expires', headerValue);
      parsed = message.parseHeader('session-expires');
      if (parsed) {
        message.session_expires = parsed.expires;
        message.session_expires_refresher = parsed.refresher;
      }
      break;
    case 'refer-to':
    case 'r':
      message.setHeader('refer-to', headerValue);
      parsed = message.parseHeader('refer-to');
      if(parsed) {
        message.refer_to = parsed;
      }
      break;
    case 'replaces':
      message.setHeader('replaces', headerValue);
      parsed = message.parseHeader('replaces');
      if(parsed) {
        message.replaces = parsed;
      }
      break;
    case 'event':
    case 'o':
      message.setHeader('event', headerValue);
      parsed = message.parseHeader('event');
      if(parsed) {
        message.event = parsed;
      }
      break;
    default:
      // Do not parse this header.
      message.setHeader(headerName, headerValue);
      parsed = 0;
  }

  if (parsed === undefined) {
    return {
      error: 'error parsing header "'+ headerName +'"'
    };
  } else {
    return true;
  }
}


/**
 * Parse SIP Message
 */
Parser.parseMessage = function(data, ua) {
  var message, firstLine, contentLength, bodyStart, parsed,
    headerStart = 0,
    headerEnd = data.indexOf('\r\n');

  if(headerEnd === -1) {
    debugerror('parseMessage() | no CRLF found, not a SIP message');
    return;
  }

  // Parse first line. Check if it is a Request or a Reply.
  firstLine = data.substring(0, headerEnd);
  parsed = Grammar.parse(firstLine, 'Request_Response');

  if(parsed === -1) {
    debugerror('parseMessage() | error parsing first line of SIP message: "' + firstLine + '"');
    return;
  } else if(!parsed.status_code) {
    message = new SIPMessage.IncomingRequest(ua);
    message.method = parsed.method;
    message.ruri = parsed.uri;
  } else {
    message = new SIPMessage.IncomingResponse();
    message.status_code = parsed.status_code;
    message.reason_phrase = parsed.reason_phrase;
  }

  message.data = data;
  headerStart = headerEnd + 2;

  /* Loop over every line in data. Detect the end of each header and parse
  * it or simply add to the headers collection.
  */
  while(true) {
    headerEnd = getHeader(data, headerStart);

    // The SIP message has normally finished.
    if(headerEnd === -2) {
      bodyStart = headerStart + 2;
      break;
    }
    // data.indexOf returned -1 due to a malformed message.
    else if(headerEnd === -1) {
      debugerror('parseMessage() | malformed message');
      return;
    }

    parsed = parseHeader(message, data, headerStart, headerEnd);

    if(parsed !== true) {
      debugerror('parseMessage() |', parsed.error);
      return;
    }

    headerStart = headerEnd + 2;
  }

  /* RFC3261 18.3.
   * If there are additional bytes in the transport packet
   * beyond the end of the body, they MUST be discarded.
   */
  if(message.hasHeader('content-length')) {
    contentLength = message.getHeader('content-length');
    message.body = data.substr(bodyStart, contentLength);
  } else {
    message.body = data.substring(bodyStart);
  }

  return message;
};

},{"./Grammar":40,"./SIPMessage":52,"debug":11}],45:[function(require,module,exports){
/* globals RTCPeerConnection: false, RTCSessionDescription: false */

module.exports = RTCSession;


var C = {
  // RTCSession states
  STATUS_NULL:               0,
  STATUS_INVITE_SENT:        1,
  STATUS_1XX_RECEIVED:       2,
  STATUS_INVITE_RECEIVED:    3,
  STATUS_WAITING_FOR_ANSWER: 4,
  STATUS_ANSWERED:           5,
  STATUS_WAITING_FOR_ACK:    6,
  STATUS_CANCELED:           7,
  STATUS_TERMINATED:         8,
  STATUS_CONFIRMED:          9
};

/**
 * Expose C object.
 */
RTCSession.C = C;


/**
 * Dependencies.
 */
var util = require('util');
var events = require('events');
var debug = require('debug')('PlivoSIP:RTCSession');
var debugerror = require('debug')('PlivoSIP:ERROR:RTCSession');
debugerror.log = console.warn.bind(console);
var sdp_transform = require('sdp-transform');
var JsSIP_C = require('./Constants');
var Exceptions = require('./Exceptions');
var Transactions = require('./Transactions');
var Utils = require('./Utils');
var Timers = require('./Timers');
var SIPMessage = require('./SIPMessage');
var Dialog = require('./Dialog');
var RequestSender = require('./RequestSender');
var RTCSession_Request = require('./RTCSession/Request');
var RTCSession_DTMF = require('./RTCSession/DTMF');
var RTCSession_ReferNotifier = require('./RTCSession/ReferNotifier');
var RTCSession_ReferSubscriber = require('./RTCSession/ReferSubscriber');


/**
 * Local variables.
 */
var holdMediaTypes = ['audio', 'video'];


function RTCSession(ua) {
  debug('new');

  this.ua = ua;
  this.status = C.STATUS_NULL;
  this.dialog = null;
  this.earlyDialogs = {};
  this.connection = null;  // The RTCPeerConnection instance (public attribute).

  // RTCSession confirmation flag
  this.is_confirmed = false;

  // is late SDP being negotiated
  this.late_sdp = false;

  // Default rtcOfferConstraints and rtcAnswerConstrainsts (passed in connect() or answer()).
  this.rtcOfferConstraints = null;
  this.rtcAnswerConstraints = null;

  // Local MediaStream.
  this.localMediaStream = null;
  this.localMediaStreamLocallyGenerated = false;

  // Flag to indicate PeerConnection ready for new actions.
  this.rtcReady = true;

  // SIP Timers
  this.timers = {
    ackTimer: null,
    expiresTimer: null,
    invite2xxTimer: null,
    userNoAnswerTimer: null
  };

  // Session info
  this.direction = null;
  this.local_identity = null;
  this.remote_identity = null;
  this.start_time = null;
  this.end_time = null;
  this.tones = null;

  // Mute/Hold state
  this.audioMuted = false;
  this.videoMuted = false;
  this.localHold = false;
  this.remoteHold = false;

  // Session Timers (RFC 4028)
  this.sessionTimers = {
    enabled: this.ua.configuration.session_timers,
    defaultExpires: JsSIP_C.SESSION_EXPIRES,
    currentExpires: null,
    running: false,
    refresher: false,
    timer: null  // A setTimeout.
  };

  // Map of ReferSubscriber instances indexed by the REFER's CSeq number
  this.referSubscribers = {};

  // Custom session empty object for high level use
  this.data = {};

  // Expose session failed/ended causes as a property of the RTCSession instance
  this.causes = JsSIP_C.causes;

  events.EventEmitter.call(this);
}

util.inherits(RTCSession, events.EventEmitter);


/**
 * User API
 */


RTCSession.prototype.isInProgress = function() {
  switch(this.status) {
    case C.STATUS_NULL:
    case C.STATUS_INVITE_SENT:
    case C.STATUS_1XX_RECEIVED:
    case C.STATUS_INVITE_RECEIVED:
    case C.STATUS_WAITING_FOR_ANSWER:
      return true;
    default:
      return false;
  }
};


RTCSession.prototype.isEstablished = function() {
  switch(this.status) {
    case C.STATUS_ANSWERED:
    case C.STATUS_WAITING_FOR_ACK:
    case C.STATUS_CONFIRMED:
      return true;
    default:
      return false;
  }
};


RTCSession.prototype.isEnded = function() {
  switch(this.status) {
    case C.STATUS_CANCELED:
    case C.STATUS_TERMINATED:
      return true;
    default:
      return false;
  }
};


RTCSession.prototype.isMuted = function() {
  return {
    audio: this.audioMuted,
    video: this.videoMuted
  };
};


RTCSession.prototype.isOnHold = function() {
  return {
    local: this.localHold,
    remote: this.remoteHold
  };
};


/**
 * Check if RTCSession is ready for an outgoing re-INVITE or UPDATE with SDP.
 */
 RTCSession.prototype.isReadyToReOffer = function() {
  if (! this.rtcReady) {
    debug('isReadyToReOffer() | internal WebRTC status not ready');
    return false;
  }

  // No established yet.
  if (! this.dialog) {
    debug('isReadyToReOffer() | session not established yet');
    return false;
  }

  // Another INVITE transaction is in progress
  if (this.dialog.uac_pending_reply === true || this.dialog.uas_pending_reply === true) {
    debug('isReadyToReOffer() | there is another INVITE/UPDATE transaction in progress');
    return false;
  }

  return true;
};



RTCSession.prototype.connect = function(target, options, initCallback) {
  debug('connect()');

  options = options || {};

  var event, requestParams,
    originalTarget = target,
    eventHandlers = options.eventHandlers || {},
    extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [],
    mediaConstraints = options.mediaConstraints || {audio: true, video: true},
    mediaStream = options.mediaStream || null,
    pcConfig = options.pcConfig || {iceServers:[]},
    rtcConstraints = options.rtcConstraints || null,
    rtcOfferConstraints = options.rtcOfferConstraints || null;

  this.rtcOfferConstraints = rtcOfferConstraints;
  this.rtcAnswerConstraints = options.rtcAnswerConstraints || null;

  // Session Timers.
  if (this.sessionTimers.enabled) {
    if (Utils.isDecimal(options.sessionTimersExpires)) {
      if (options.sessionTimersExpires >= JsSIP_C.MIN_SESSION_EXPIRES) {
        this.sessionTimers.defaultExpires = options.sessionTimersExpires;
      }
      else {
        this.sessionTimers.defaultExpires = JsSIP_C.SESSION_EXPIRES;
      }
    }
  }

  this.data = options.data || this.data;

  if (target === undefined) {
    throw new TypeError('Not enough arguments');
  }

  // Check WebRTC support.
  if (!window.RTCPeerConnection) {
    throw new Exceptions.NotSupportedError('WebRTC not supported');
  }

  // Check target validity
  target = this.ua.normalizeTarget(target);
  if (!target) {
    throw new TypeError('Invalid target: '+ originalTarget);
  }

  // Check Session Status
  if (this.status !== C.STATUS_NULL) {
    throw new Exceptions.InvalidStateError(this.status);
  }

  // Set event handlers
  for (event in eventHandlers) {
    this.on(event, eventHandlers[event]);
  }

  // Session parameter initialization
  this.from_tag = Utils.newTag();

  // Set anonymous property
  this.anonymous = options.anonymous || false;

  // OutgoingSession specific parameters
  this.isCanceled = false;

  requestParams = {from_tag: this.from_tag};

  this.contact = this.ua.contact.toString({
    anonymous: this.anonymous,
    outbound: true
  });

  if (this.anonymous) {
    requestParams.from_display_name = 'Anonymous';
    requestParams.from_uri = 'sip:anonymous@anonymous.invalid';

    extraHeaders.push('P-Preferred-Identity: '+ this.ua.configuration.uri.toString());
    extraHeaders.push('Privacy: id');
  }

  extraHeaders.push('Contact: '+ this.contact);
  extraHeaders.push('Content-Type: application/sdp');
  if (this.sessionTimers.enabled) {
    extraHeaders.push('Session-Expires: ' + this.sessionTimers.defaultExpires);
  }

  this.request = new SIPMessage.OutgoingRequest(JsSIP_C.INVITE, target, this.ua, requestParams, extraHeaders);

  this.id = this.request.call_id + this.from_tag;

  // Create a new RTCPeerConnection instance.
  createRTCConnection.call(this, pcConfig, rtcConstraints);

  // Save the session into the ua sessions collection.
  this.ua.sessions[this.id] = this;

  // Set internal properties
  this.direction = 'outgoing';
  this.local_identity = this.request.from;
  this.remote_identity = this.request.to;

  // User explicitly provided a newRTCSession callback for this session
  if (initCallback) {
    initCallback(this);
  } else {
    newRTCSession.call(this, 'local', this.request);
  }

  sendInitialRequest.call(this, mediaConstraints, rtcOfferConstraints, mediaStream);
};


RTCSession.prototype.init_incoming = function(request, initCallback) {
  debug('init_incoming()');

  var expires,
    self = this,
    contentType = request.getHeader('Content-Type');

  // Check body and content type
  if (request.body && (contentType !== 'application/sdp')) {
    request.reply(415);
    return;
  }

  // Session parameter initialization
  this.status = C.STATUS_INVITE_RECEIVED;
  this.from_tag = request.from_tag;
  this.id = request.call_id + this.from_tag;
  this.request = request;
  this.contact = this.ua.contact.toString();

  // Save the session into the ua sessions collection.
  this.ua.sessions[this.id] = this;

  // Get the Expires header value if exists
  if (request.hasHeader('expires')) {
    expires = request.getHeader('expires') * 1000;
  }

  /* Set the to_tag before
   * replying a response code that will create a dialog.
   */
  request.to_tag = Utils.newTag();

  // An error on dialog creation will fire 'failed' event
  if (! createDialog.call(this, request, 'UAS', true)) {
    request.reply(500, 'Missing Contact header field');
    return;
  }

  if (request.body) {
    this.late_sdp = false;
  }
  else {
    this.late_sdp = true;
  }

  this.status = C.STATUS_WAITING_FOR_ANSWER;

  // Set userNoAnswerTimer
  this.timers.userNoAnswerTimer = setTimeout(function() {
      request.reply(408);
      failed.call(self, 'local',null, JsSIP_C.causes.NO_ANSWER);
    }, this.ua.configuration.no_answer_timeout
  );

  /* Set expiresTimer
   * RFC3261 13.3.1
   */
  if (expires) {
    this.timers.expiresTimer = setTimeout(function() {
        if(self.status === C.STATUS_WAITING_FOR_ANSWER) {
          request.reply(487);
          failed.call(self, 'system', null, JsSIP_C.causes.EXPIRES);
        }
      }, expires
    );
  }

  // Set internal properties
  this.direction = 'incoming';
  this.local_identity = request.to;
  this.remote_identity = request.from;

  // A init callback was specifically defined
  if (initCallback) {
    initCallback(this);

  // Fire 'newRTCSession' event.
  } else {
    newRTCSession.call(this, 'remote', request);
  }

  // The user may have rejected the call in the 'newRTCSession' event.
  if (this.status === C.STATUS_TERMINATED) {
    return;
  }

  // Reply 180.
  request.reply(180, null, ['Contact: ' + self.contact]);

  // Fire 'progress' event.
  // TODO: Document that 'response' field in 'progress' event is null for
  // incoming calls.
  progress.call(self, 'local', null);
};


/**
 * Answer the call.
 */
RTCSession.prototype.answer = function(options) {
  debug('answer()');

  options = options || {};

  var idx, length, sdp, tracks,
    peerHasAudioLine = false,
    peerHasVideoLine = false,
    peerOffersFullAudio = false,
    peerOffersFullVideo = false,
    self = this,
    request = this.request,
    extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [],
    mediaConstraints = options.mediaConstraints || {},
    mediaStream = options.mediaStream || null,
    pcConfig = options.pcConfig || {iceServers:[]},
    rtcConstraints = options.rtcConstraints || null,
    rtcAnswerConstraints = options.rtcAnswerConstraints || null;

  this.rtcAnswerConstraints = rtcAnswerConstraints;
  this.rtcOfferConstraints = options.rtcOfferConstraints || null;

  // Session Timers.
  if (this.sessionTimers.enabled) {
    if (Utils.isDecimal(options.sessionTimersExpires)) {
      if (options.sessionTimersExpires >= JsSIP_C.MIN_SESSION_EXPIRES) {
        this.sessionTimers.defaultExpires = options.sessionTimersExpires;
      }
      else {
        this.sessionTimers.defaultExpires = JsSIP_C.SESSION_EXPIRES;
      }
    }
  }

  this.data = options.data || this.data;

  // Check Session Direction and Status
  if (this.direction !== 'incoming') {
    throw new Exceptions.NotSupportedError('"answer" not supported for outgoing RTCSession');
  } else if (this.status !== C.STATUS_WAITING_FOR_ANSWER) {
    throw new Exceptions.InvalidStateError(this.status);
  }

  this.status = C.STATUS_ANSWERED;

  // An error on dialog creation will fire 'failed' event
  if (! createDialog.call(this, request, 'UAS')) {
    request.reply(500, 'Error creating dialog');
    return;
  }

  clearTimeout(this.timers.userNoAnswerTimer);

  extraHeaders.unshift('Contact: ' + self.contact);

  // Determine incoming media from incoming SDP offer (if any).
  sdp = request.parseSDP();

  // Make sure sdp.media is an array, not the case if there is only one media
  if (! Array.isArray(sdp.media)) {
    sdp.media = [sdp.media];
  }

  // Go through all medias in SDP to find offered capabilities to answer with
  idx = sdp.media.length;
  while(idx--) {
    var m = sdp.media[idx];
    if (m.type === 'audio') {
      peerHasAudioLine = true;
      if (!m.direction || m.direction === 'sendrecv') {
        peerOffersFullAudio = true;
      }
    }
    if (m.type === 'video') {
      peerHasVideoLine = true;
      if (!m.direction || m.direction === 'sendrecv') {
        peerOffersFullVideo = true;
      }
    }
  }

  // Remove audio from mediaStream if suggested by mediaConstraints
  if (mediaStream && mediaConstraints.audio === false) {
    tracks = mediaStream.getAudioTracks();
    length = tracks.length;
    for (idx=0; idx<length; idx++) {
      mediaStream.removeTrack(tracks[idx]);
    }
  }

  // Remove video from mediaStream if suggested by mediaConstraints
  if (mediaStream && mediaConstraints.video === false) {
    tracks = mediaStream.getVideoTracks();
    length = tracks.length;
    for (idx=0; idx<length; idx++) {
      mediaStream.removeTrack(tracks[idx]);
    }
  }

  // Set audio constraints based on incoming stream if not supplied
  if (!mediaStream && mediaConstraints.audio === undefined) {
    mediaConstraints.audio = peerOffersFullAudio;
  }

  // Set video constraints based on incoming stream if not supplied
  if (!mediaStream && mediaConstraints.video === undefined) {
    mediaConstraints.video = peerOffersFullVideo;
  }

  // Don't ask for audio if the incoming offer has no audio section
  if (!mediaStream && !peerHasAudioLine) {
    mediaConstraints.audio = false;
  }

  // Don't ask for video if the incoming offer has no video section
  if (!mediaStream && !peerHasVideoLine) {
    mediaConstraints.video = false;
  }

  // Create a new RTCPeerConnection instance.
  // TODO: This may throw an error, should react.
  createRTCConnection.call(this, pcConfig, rtcConstraints);

  // If a local MediaStream is given use it.
  if (mediaStream) {
    userMediaSucceeded(mediaStream);
  // If at least audio or video is requested prompt getUserMedia.
  } else if (mediaConstraints.audio || mediaConstraints.video) {
    self.localMediaStreamLocallyGenerated = true;
    navigator.mediaDevices.getUserMedia(mediaConstraints)
      .then(userMediaSucceeded)
      .catch(function(error) {
        userMediaFailed(error);

        self.emit('getusermediafailed', error);
      });
  // Otherwise don't prompt getUserMedia.
  } else {
    userMediaSucceeded(null);
  }

  // User media succeeded
  function userMediaSucceeded(stream) {
    if (self.status === C.STATUS_TERMINATED) { return; }

    self.localMediaStream = stream;
    if (stream) {
      self.connection.addStream(stream);
    }

    // If it's an incoming INVITE without SDP notify the app with the
    // RTCPeerConnection so it can do stuff on it before generating the offer.
    if (! self.request.body) {
      self.emit('peerconnection', {
        peerconnection: self.connection
      });
    }

    if (! self.late_sdp) {
      var e = {originator:'remote', type:'offer', sdp:request.body};
      var offer = new RTCSessionDescription({type:'offer', sdp:e.sdp});

      self.emit('sdp', e);

      self.connection.setRemoteDescription(offer)
        .then(remoteDescriptionSucceededOrNotNeeded)
        .catch(function(error) {
          request.reply(488);
          failed.call(self, 'system', null, JsSIP_C.causes.WEBRTC_ERROR);

          self.emit('peerconnection:setremotedescriptionfailed', error);
        });
    }
    else {
      remoteDescriptionSucceededOrNotNeeded();
    }
  }

  // User media failed
  function userMediaFailed() {
    if (self.status === C.STATUS_TERMINATED) { return; }

    request.reply(480);
    failed.call(self, 'local', null, JsSIP_C.causes.USER_DENIED_MEDIA_ACCESS);
  }

  function remoteDescriptionSucceededOrNotNeeded() {
    connecting.call(self, request);
    if (! self.late_sdp) {
      createLocalDescription.call(self, 'answer', rtcSucceeded, rtcFailed, rtcAnswerConstraints);
    } else {
      createLocalDescription.call(self, 'offer', rtcSucceeded, rtcFailed, self.rtcOfferConstraints);
    }
  }

  function rtcSucceeded(desc) {
    if (self.status === C.STATUS_TERMINATED) { return; }

    // run for reply success callback
    function replySucceeded() {
      self.status = C.STATUS_WAITING_FOR_ACK;

      setInvite2xxTimer.call(self, request, desc);
      setACKTimer.call(self);
      accepted.call(self, 'local');
    }

    // run for reply failure callback
    function replyFailed() {
      failed.call(self, 'system', null, JsSIP_C.causes.CONNECTION_ERROR);
    }

    handleSessionTimersInIncomingRequest.call(self, request, extraHeaders);

    request.reply(200, null, extraHeaders,
      desc,
      replySucceeded,
      replyFailed
    );
  }

  function rtcFailed() {
    if (self.status === C.STATUS_TERMINATED) { return; }

    request.reply(500);
    failed.call(self, 'system', null, JsSIP_C.causes.WEBRTC_ERROR);
  }
};


/**
 * Terminate the call.
 */
RTCSession.prototype.terminate = function(options) {
  debug('terminate()');

  options = options || {};

  var cancel_reason, dialog,
    cause = options.cause || JsSIP_C.causes.BYE,
    status_code = options.status_code,
    reason_phrase = options.reason_phrase,
    extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [],
    body = options.body,
    self = this;

  // Check Session Status
  if (this.status === C.STATUS_TERMINATED) {
    throw new Exceptions.InvalidStateError(this.status);
  }

  switch(this.status) {
    // - UAC -
    case C.STATUS_NULL:
    case C.STATUS_INVITE_SENT:
    case C.STATUS_1XX_RECEIVED:
      debug('canceling session');

      if (status_code && (status_code < 200 || status_code >= 700)) {
        throw new TypeError('Invalid status_code: '+ status_code);
      } else if (status_code) {
        reason_phrase = reason_phrase || JsSIP_C.REASON_PHRASE[status_code] || '';
        cancel_reason = 'SIP ;cause=' + status_code + ' ;text="' + reason_phrase + '"';
      }

      // Check Session Status
      if (this.status === C.STATUS_NULL) {
        this.isCanceled = true;
        this.cancelReason = cancel_reason;
      } else if (this.status === C.STATUS_INVITE_SENT) {
        this.isCanceled = true;
        this.cancelReason = cancel_reason;
      } else if(this.status === C.STATUS_1XX_RECEIVED) {
        this.request.cancel(cancel_reason);
      }

      this.status = C.STATUS_CANCELED;

      failed.call(this, 'local', null, JsSIP_C.causes.CANCELED);
      break;

      // - UAS -
    case C.STATUS_WAITING_FOR_ANSWER:
    case C.STATUS_ANSWERED:
      debug('rejecting session');

      status_code = status_code || 480;

      if (status_code < 300 || status_code >= 700) {
        throw new TypeError('Invalid status_code: '+ status_code);
      }

      this.request.reply(status_code, reason_phrase, extraHeaders, body);
      failed.call(this, 'local', null, JsSIP_C.causes.REJECTED);
      break;

    case C.STATUS_WAITING_FOR_ACK:
    case C.STATUS_CONFIRMED:
      debug('terminating session');

      reason_phrase = options.reason_phrase || JsSIP_C.REASON_PHRASE[status_code] || '';

      if (status_code && (status_code < 200 || status_code >= 700)) {
        throw new TypeError('Invalid status_code: '+ status_code);
      } else if (status_code) {
        extraHeaders.push('Reason: SIP ;cause=' + status_code + '; text="' + reason_phrase + '"');
      }

      /* RFC 3261 section 15 (Terminating a session):
        *
        * "...the callee's UA MUST NOT send a BYE on a confirmed dialog
        * until it has received an ACK for its 2xx response or until the server
        * transaction times out."
        */
      if (this.status === C.STATUS_WAITING_FOR_ACK &&
          this.direction === 'incoming' &&
          this.request.server_transaction.state !== Transactions.C.STATUS_TERMINATED) {

        // Save the dialog for later restoration
        dialog = this.dialog;

        // Send the BYE as soon as the ACK is received...
        this.receiveRequest = function(request) {
          if(request.method === JsSIP_C.ACK) {
            sendRequest.call(this, JsSIP_C.BYE, {
              extraHeaders: extraHeaders,
              body: body
            });
            dialog.terminate();
          }
        };

        // .., or when the INVITE transaction times out
        this.request.server_transaction.on('stateChanged', function(){
          if (this.state === Transactions.C.STATUS_TERMINATED) {
            sendRequest.call(self, JsSIP_C.BYE, {
              extraHeaders: extraHeaders,
              body: body
            });
            dialog.terminate();
          }
        });

        ended.call(this, 'local', null, cause);

        // Restore the dialog into 'this' in order to be able to send the in-dialog BYE :-)
        this.dialog = dialog;

        // Restore the dialog into 'ua' so the ACK can reach 'this' session
        this.ua.dialogs[dialog.id.toString()] = dialog;

      } else {
        sendRequest.call(this, JsSIP_C.BYE, {
          extraHeaders: extraHeaders,
          body: body
        });

        ended.call(this, 'local', null, cause);
      }
  }
};


RTCSession.prototype.close = function() {
  debug('close()');

  var idx;

  if (this.status === C.STATUS_TERMINATED) {
    return;
  }

  // Terminate RTC.
  if (this.connection) {
    try {
      this.connection.close();
    } catch(error) {
      debugerror('close() | error closing the RTCPeerConnection: %o', error);
    }
  }

  // Close local MediaStream if it was not given by the user.
  if (this.localMediaStream && this.localMediaStreamLocallyGenerated) {
    debug('close() | closing local MediaStream');

    Utils.closeMediaStream(this.localMediaStream);
  }

  // Terminate signaling.

  // Clear SIP timers
  for(idx in this.timers) {
    clearTimeout(this.timers[idx]);
  }

  // Clear Session Timers.
  clearTimeout(this.sessionTimers.timer);

  // Terminate confirmed dialog
  if (this.dialog) {
    this.dialog.terminate();
    delete this.dialog;
  }

  // Terminate early dialogs
  for(idx in this.earlyDialogs) {
    this.earlyDialogs[idx].terminate();
    delete this.earlyDialogs[idx];
  }

  this.status = C.STATUS_TERMINATED;

  delete this.ua.sessions[this.id];
};


RTCSession.prototype.sendDTMF = function(tones, options) {
  debug('sendDTMF() | tones: %s', tones);

  var duration, interToneGap,
    position = 0,
    self = this;

  options = options || {};
  duration = options.duration || null;
  interToneGap = options.interToneGap || null;

  if (tones === undefined) {
    throw new TypeError('Not enough arguments');
  }

  // Check Session Status
  if (this.status !== C.STATUS_CONFIRMED && this.status !== C.STATUS_WAITING_FOR_ACK) {
    throw new Exceptions.InvalidStateError(this.status);
  }

  // Convert to string
  if(typeof tones === 'number') {
    tones = tones.toString();
  }

  // Check tones
  if (!tones || typeof tones !== 'string' || !tones.match(/^[0-9A-D#*,]+$/i)) {
    throw new TypeError('Invalid tones: '+ tones);
  }

  // Check duration
  if (duration && !Utils.isDecimal(duration)) {
    throw new TypeError('Invalid tone duration: '+ duration);
  } else if (!duration) {
    duration = RTCSession_DTMF.C.DEFAULT_DURATION;
  } else if (duration < RTCSession_DTMF.C.MIN_DURATION) {
    debug('"duration" value is lower than the minimum allowed, setting it to '+ RTCSession_DTMF.C.MIN_DURATION+ ' milliseconds');
    duration = RTCSession_DTMF.C.MIN_DURATION;
  } else if (duration > RTCSession_DTMF.C.MAX_DURATION) {
    debug('"duration" value is greater than the maximum allowed, setting it to '+ RTCSession_DTMF.C.MAX_DURATION +' milliseconds');
    duration = RTCSession_DTMF.C.MAX_DURATION;
  } else {
    duration = Math.abs(duration);
  }
  options.duration = duration;

  // Check interToneGap
  if (interToneGap && !Utils.isDecimal(interToneGap)) {
    throw new TypeError('Invalid interToneGap: '+ interToneGap);
  } else if (!interToneGap) {
    interToneGap = RTCSession_DTMF.C.DEFAULT_INTER_TONE_GAP;
  } else if (interToneGap < RTCSession_DTMF.C.MIN_INTER_TONE_GAP) {
    debug('"interToneGap" value is lower than the minimum allowed, setting it to '+ RTCSession_DTMF.C.MIN_INTER_TONE_GAP +' milliseconds');
    interToneGap = RTCSession_DTMF.C.MIN_INTER_TONE_GAP;
  } else {
    interToneGap = Math.abs(interToneGap);
  }

  if (this.tones) {
    // Tones are already queued, just add to the queue
    this.tones += tones;
    return;
  }

  this.tones = tones;

  // Send the first tone
  _sendDTMF();

  function _sendDTMF() {
    var tone, timeout;

    if (self.status === C.STATUS_TERMINATED || !self.tones || position >= self.tones.length) {
      // Stop sending DTMF
      self.tones = null;
      return;
    }

    tone = self.tones[position];
    position += 1;

    if (tone === ',') {
      timeout = 2000;
    } else {
      var dtmf = new RTCSession_DTMF(self);
      options.eventHandlers = {
        failed: function() { self.tones = null; }
      };
      dtmf.send(tone, options);
      timeout = duration + interToneGap;
    }

    // Set timeout for the next tone
    setTimeout(_sendDTMF, timeout);
  }
};


/**
 * Mute
 */
RTCSession.prototype.mute = function(options) {
  debug('mute()');

  options = options || {audio:true, video:false};

  var
    audioMuted = false,
    videoMuted = false;

  if (this.audioMuted === false && options.audio) {
    audioMuted = true;
    this.audioMuted = true;
    toogleMuteAudio.call(this, true);
  }

  if (this.videoMuted === false && options.video) {
    videoMuted = true;
    this.videoMuted = true;
    toogleMuteVideo.call(this, true);
  }

  if (audioMuted === true || videoMuted === true) {
    onmute.call(this, {
      audio: audioMuted,
      video: videoMuted
    });
  }
};


/**
 * Unmute
 */
RTCSession.prototype.unmute = function(options) {
  debug('unmute()');

  options = options || {audio:true, video:true};

  var
    audioUnMuted = false,
    videoUnMuted = false;

  if (this.audioMuted === true && options.audio) {
    audioUnMuted = true;
    this.audioMuted = false;

    if (this.localHold === false) {
      toogleMuteAudio.call(this, false);
    }
  }

  if (this.videoMuted === true && options.video) {
    videoUnMuted = true;
    this.videoMuted = false;

    if (this.localHold === false) {
      toogleMuteVideo.call(this, false);
    }
  }

  if (audioUnMuted === true || videoUnMuted === true) {
    onunmute.call(this, {
      audio: audioUnMuted,
      video: videoUnMuted
    });
  }
};


/**
 * Hold
 */
RTCSession.prototype.hold = function(options, done) {
  debug('hold()');

  options = options || {};

  var self = this,
    eventHandlers;

  if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
    return false;
  }

  if (this.localHold === true) {
    return false;
  }

  if (! this.isReadyToReOffer()) {
    return false;
  }

  this.localHold = true;
  onhold.call(this, 'local');

  eventHandlers = {
    succeeded: function() {
      if (done) { done(); }
    },
    failed: function() {
      self.terminate({
        cause: JsSIP_C.causes.WEBRTC_ERROR,
        status_code: 500,
        reason_phrase: 'Hold Failed'
      });
    }
  };

  if (options.useUpdate) {
    sendUpdate.call(this, {
      sdpOffer: true,
      eventHandlers: eventHandlers,
      extraHeaders: options.extraHeaders
    });
  } else {
    sendReinvite.call(this, {
      eventHandlers: eventHandlers,
      extraHeaders: options.extraHeaders
    });
  }

  return true;
};


RTCSession.prototype.unhold = function(options, done) {
  debug('unhold()');

  options = options || {};

  var self = this,
    eventHandlers;

  if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
    return false;
  }

  if (this.localHold === false) {
    return false;
  }

  if (! this.isReadyToReOffer()) {
    return false;
  }

  this.localHold = false;
  onunhold.call(this, 'local');

  eventHandlers = {
    succeeded: function() {
      if (done) { done(); }
    },
    failed: function() {
      self.terminate({
        cause: JsSIP_C.causes.WEBRTC_ERROR,
        status_code: 500,
        reason_phrase: 'Unhold Failed'
      });
    }
  };

  if (options.useUpdate) {
    sendUpdate.call(this, {
      sdpOffer: true,
      eventHandlers: eventHandlers,
      extraHeaders: options.extraHeaders
    });
  } else {
    sendReinvite.call(this, {
      eventHandlers: eventHandlers,
      extraHeaders: options.extraHeaders
    });
  }

  return true;
};


RTCSession.prototype.renegotiate = function(options, done) {
  debug('renegotiate()');

  options = options || {};

  var self = this,
    eventHandlers,
    rtcOfferConstraints = options.rtcOfferConstraints || null;

  if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
    return false;
  }

  if (! this.isReadyToReOffer()) {
    return false;
  }

  eventHandlers = {
    succeeded: function() {
      if (done) { done(); }
    },
    failed: function() {
      self.terminate({
        cause: JsSIP_C.causes.WEBRTC_ERROR,
        status_code: 500,
        reason_phrase: 'Media Renegotiation Failed'
      });
    }
  };

  setLocalMediaStatus.call(this);

  if (options.useUpdate) {
    sendUpdate.call(this, {
      sdpOffer: true,
      eventHandlers: eventHandlers,
      rtcOfferConstraints: rtcOfferConstraints,
      extraHeaders: options.extraHeaders
    });
  } else {
    sendReinvite.call(this, {
      eventHandlers: eventHandlers,
      rtcOfferConstraints: rtcOfferConstraints,
      extraHeaders: options.extraHeaders
    });
  }

  return true;
};

/**
 * Refer
 */
RTCSession.prototype.refer = function(target, options) {
  debug('refer()');

  var self = this,
    originalTarget = target,
    referSubscriber,
    id;

  if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
    return false;
  }

  // Check target validity
  target = this.ua.normalizeTarget(target);
  if (!target) {
    throw new TypeError('Invalid target: '+ originalTarget);
  }

  referSubscriber = new RTCSession_ReferSubscriber(this);
  referSubscriber.sendRefer(target, options);

  // Store in the map
  id = referSubscriber.outgoingRequest.cseq;
  this.referSubscribers[id] = referSubscriber;

  // Listen for ending events so we can remove it from the map
  referSubscriber.on('requestFailed', function() {
    delete self.referSubscribers[id];
  });
  referSubscriber.on('accepted', function() {
    delete self.referSubscribers[id];
  });
  referSubscriber.on('failed', function() {
    delete self.referSubscribers[id];
  });

  return referSubscriber;
};

/**
 * In dialog Request Reception
 */
RTCSession.prototype.receiveRequest = function(request) {
  debug('receiveRequest()');

  var contentType,
      self = this;

  if(request.method === JsSIP_C.CANCEL) {
    /* RFC3261 15 States that a UAS may have accepted an invitation while a CANCEL
    * was in progress and that the UAC MAY continue with the session established by
    * any 2xx response, or MAY terminate with BYE. JsSIP does continue with the
    * established session. So the CANCEL is processed only if the session is not yet
    * established.
    */

    /*
    * Terminate the whole session in case the user didn't accept (or yet send the answer)
    * nor reject the request opening the session.
    */
    if(this.status === C.STATUS_WAITING_FOR_ANSWER  || this.status === C.STATUS_ANSWERED) {
      this.status = C.STATUS_CANCELED;
      this.request.reply(487);
      failed.call(this, 'remote', request, JsSIP_C.causes.CANCELED);
    }
  } else {
    // Requests arriving here are in-dialog requests.
    switch(request.method) {
      case JsSIP_C.ACK:
        if (this.status !== C.STATUS_WAITING_FOR_ACK) {
          return;
        }

        // Update signaling status.
        this.status = C.STATUS_CONFIRMED;

        clearTimeout(this.timers.ackTimer);
        clearTimeout(this.timers.invite2xxTimer);

        if (this.late_sdp) {
          if (!request.body) {
            this.terminate({
              cause: JsSIP_C.causes.MISSING_SDP,
              status_code: 400
            });
            break;
          }

          var e = {originator:'remote', type:'answer', sdp:request.body};
          var answer = new RTCSessionDescription({type:'answer', sdp:e.sdp});

          this.emit('sdp', e);

          this.connection.setRemoteDescription(answer)
            .then(function() {
              if (!self.is_confirmed) {
                confirmed.call(self, 'remote', request);
              }
            })
            .catch(function(error) {
              self.terminate({
                cause: JsSIP_C.causes.BAD_MEDIA_DESCRIPTION,
                status_code: 488
              });

              self.emit('peerconnection:setremotedescriptionfailed', error);
            });
        }
        else {
          if (!this.is_confirmed) {
            confirmed.call(this, 'remote', request);
          }
        }

        break;
      case JsSIP_C.BYE:
        if(this.status === C.STATUS_CONFIRMED) {
          request.reply(200);
          ended.call(this, 'remote', request, JsSIP_C.causes.BYE);
        }
        else if (this.status === C.STATUS_INVITE_RECEIVED) {
          request.reply(200);
          this.request.reply(487, 'BYE Received');
          ended.call(this, 'remote', request, JsSIP_C.causes.BYE);
        }
        else {
          request.reply(403, 'Wrong Status');
        }
        break;
      case JsSIP_C.INVITE:
        if(this.status === C.STATUS_CONFIRMED) {
          if (request.hasHeader('replaces')) {
            receiveReplaces.call(this, request);
          } else {
            receiveReinvite.call(this, request);
          }
        }
        else {
          request.reply(403, 'Wrong Status');
        }
        break;
      case JsSIP_C.INFO:
        if(this.status === C.STATUS_CONFIRMED || this.status === C.STATUS_WAITING_FOR_ACK || this.status === C.STATUS_INVITE_RECEIVED) {
          contentType = request.getHeader('content-type');
          if (contentType && (contentType.match(/^application\/dtmf-relay/i))) {
            new RTCSession_DTMF(this).init_incoming(request);
          }
          else {
            request.reply(415);
          }
        }
        else {
          request.reply(403, 'Wrong Status');
        }
        break;
      case JsSIP_C.UPDATE:
        if(this.status === C.STATUS_CONFIRMED) {
          receiveUpdate.call(this, request);
        }
        else {
          request.reply(403, 'Wrong Status');
        }
        break;
      case JsSIP_C.REFER:
        if(this.status === C.STATUS_CONFIRMED) {
          receiveRefer.call(this, request);
        }
        else {
          request.reply(403, 'Wrong Status');
        }
        break;
      case JsSIP_C.NOTIFY:
        if(this.status === C.STATUS_CONFIRMED) {
          receiveNotify.call(this, request);
        }
        else {
          request.reply(403, 'Wrong Status');
        }
        break;
      default:
        request.reply(501);
    }
  }
};


/**
 * Session Callbacks
 */

RTCSession.prototype.onTransportError = function() {
  debugerror('onTransportError()');

  if(this.status !== C.STATUS_TERMINATED) {
    this.terminate({
      status_code: 500,
      reason_phrase: JsSIP_C.causes.CONNECTION_ERROR,
      cause: JsSIP_C.causes.CONNECTION_ERROR
    });
  }
};


RTCSession.prototype.onRequestTimeout = function() {
  debug('onRequestTimeout');

  if(this.status !== C.STATUS_TERMINATED) {
    this.terminate({
      status_code: 408,
      reason_phrase: JsSIP_C.causes.REQUEST_TIMEOUT,
      cause: JsSIP_C.causes.REQUEST_TIMEOUT
    });
  }
};


RTCSession.prototype.onDialogError = function() {
  debugerror('onDialogError()');

  if(this.status !== C.STATUS_TERMINATED) {
    this.terminate({
      status_code: 500,
      reason_phrase: JsSIP_C.causes.DIALOG_ERROR,
      cause: JsSIP_C.causes.DIALOG_ERROR
    });
  }
};


// Called from DTMF handler.
RTCSession.prototype.newDTMF = function(data) {
  debug('newDTMF()');

  this.emit('newDTMF', data);
};


RTCSession.prototype.resetLocalMedia = function() {
  debug('resetLocalMedia()');

  // Reset all but remoteHold.
  this.localHold = false;
  this.audioMuted = false;
  this.videoMuted = false;

  setLocalMediaStatus.call(this);
};


/**
 * Private API.
 */


/**
 * RFC3261 13.3.1.4
 * Response retransmissions cannot be accomplished by transaction layer
 *  since it is destroyed when receiving the first 2xx answer
 */
function setInvite2xxTimer(request, body) {
  var
    self = this,
    timeout = Timers.T1;

  this.timers.invite2xxTimer = setTimeout(function invite2xxRetransmission() {
    if (self.status !== C.STATUS_WAITING_FOR_ACK) {
      return;
    }

    request.reply(200, null, ['Contact: '+ self.contact], body);

    if (timeout < Timers.T2) {
      timeout = timeout * 2;
      if (timeout > Timers.T2) {
        timeout = Timers.T2;
      }
    }
    self.timers.invite2xxTimer = setTimeout(
      invite2xxRetransmission, timeout
    );
  }, timeout);
}


/**
 * RFC3261 14.2
 * If a UAS generates a 2xx response and never receives an ACK,
 *  it SHOULD generate a BYE to terminate the dialog.
 */
function setACKTimer() {
  var self = this;

  this.timers.ackTimer = setTimeout(function() {
    if(self.status === C.STATUS_WAITING_FOR_ACK) {
      debug('no ACK received, terminating the session');
      clearTimeout(self.timers.invite2xxTimer);
      sendRequest.call(self, JsSIP_C.BYE);
      ended.call(self, 'remote', null, JsSIP_C.causes.NO_ACK);
    }
  }, Timers.TIMER_H);
}


function createRTCConnection(pcConfig, rtcConstraints) {
  var self = this;

  this.connection = new RTCPeerConnection(pcConfig, rtcConstraints);

  this.connection.addEventListener('iceconnectionstatechange', function() {
    var state = self.connection.iceConnectionState;

    // TODO: Do more with different states.
    // Plivo patch for disable RTP timeout
    if (state === 'failed' && !this.disableRtpTimeOut) {
      self.terminate({
        cause: JsSIP_C.causes.RTP_TIMEOUT,
        status_code: 200,
        reason_phrase: JsSIP_C.causes.RTP_TIMEOUT
      });
    }
  });
}

function createLocalDescription(type, onSuccess, onFailure, constraints) {
  debug('createLocalDescription()');

  var self = this;
  var connection = this.connection;

  this.rtcReady = false;

  if (type === 'offer') {
    connection.createOffer(constraints)
      .then(createSucceeded)
      .catch(function(error) {
        self.rtcReady = true;
        if (onFailure) { onFailure(error); }

        self.emit('peerconnection:createofferfailed', error);
      });
  }
  else if (type === 'answer') {
    connection.createAnswer(constraints)
      .then(createSucceeded)
      .catch(function(error) {
        self.rtcReady = true;
        if (onFailure) { onFailure(error); }

        self.emit('peerconnection:createanswerfailed', error);
      });
  }
  else {
    throw new Error('createLocalDescription() | type must be "offer" or "answer", but "' +type+ '" was given');
  }

  // createAnswer or createOffer succeeded
  function createSucceeded(desc) {
    var listener;
    /*
      Plivo patch for gatherTimeout
    */    
    var srflxReceived=false;

    connection.addEventListener('icecandidate', listener = function(event) {
      var candidate = event.candidate;
      // Look for external ip with srflx string
      if(candidate && candidate.candidate.search('srflx') != -1){
        srflxReceived=true;
      }
      if (!candidate || srflxReceived) {
        connection.removeEventListener('icecandidate', listener);
        self.rtcReady = true;

        if (onSuccess) {
          var e = {originator:'local', type:type, sdp:connection.localDescription.sdp};

          self.emit('sdp', e);
          onSuccess(e.sdp);
          debug('iceGathering completed');
        }
        onSuccess = null;
      }
    });

    connection.setLocalDescription(desc)
      .then(function() {
        if (connection.iceGatheringState != 'complete') {
          setTimeout(function() {
            if (connection.iceGatheringState === 'complete') {
              debug('iceGathering already completed');
              return;
            }
            self.rtcReady = true;
            if (onSuccess) {
              var e = {
                  originator: 'local',
                  type: type,
                  sdp: connection.localDescription.sdp
              };
              self.emit('sdp', e);
              onSuccess(e.sdp);
              onSuccess = null;
              debug('iceGathering taking more than 2sec '+connection.iceGatheringState);
              iceTimeOut.call(self, 2000);           
            }
          }, 2000);
        }
        debug('iceGatheringState after setLocalDescription success: ' + connection.iceGatheringState);
      })
      .catch(function(error) {
        self.rtcReady = true;
        if (onFailure) { onFailure(error); }

        self.emit('peerconnection:setlocaldescriptionfailed', error);
      });
  }
}


/**
 * Dialog Management
 */
function createDialog(message, type, early) {
  var dialog, early_dialog,
    local_tag = (type === 'UAS') ? message.to_tag : message.from_tag,
    remote_tag = (type === 'UAS') ? message.from_tag : message.to_tag,
    id = message.call_id + local_tag + remote_tag;

    early_dialog = this.earlyDialogs[id];

  // Early Dialog
  if (early) {
    if (early_dialog) {
      return true;
    } else {
      early_dialog = new Dialog(this, message, type, Dialog.C.STATUS_EARLY);

      // Dialog has been successfully created.
      if(early_dialog.error) {
        debug(early_dialog.error);
        failed.call(this, 'remote', message, JsSIP_C.causes.INTERNAL_ERROR);
        return false;
      } else {
        this.earlyDialogs[id] = early_dialog;
        return true;
      }
    }
  }

  // Confirmed Dialog
  else {
    this.from_tag = message.from_tag;
    this.to_tag = message.to_tag;

    // In case the dialog is in _early_ state, update it
    if (early_dialog) {
      early_dialog.update(message, type);
      this.dialog = early_dialog;
      delete this.earlyDialogs[id];
      return true;
    }

    // Otherwise, create a _confirmed_ dialog
    dialog = new Dialog(this, message, type);

    if(dialog.error) {
      debug(dialog.error);
      failed.call(this, 'remote', message, JsSIP_C.causes.INTERNAL_ERROR);
      return false;
    } else {
      this.dialog = dialog;
      return true;
    }
  }
}

/**
 * In dialog INVITE Reception
 */

function receiveReinvite(request) {
  debug('receiveReinvite()');

  var
    sdp, idx, direction, m,
    self = this,
    contentType = request.getHeader('Content-Type'),
    hold = false,
    rejected = false,
    data = {
      request: request,
      callback: undefined,
      reject: reject.bind(this)
    };

  function reject(options) {
    options = options || {};
    rejected = true;

    var
      status_code = options.status_code || 403,
      reason_phrase = options.reason_phrase || '',
      extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [];

    if (this.status !== C.STATUS_CONFIRMED) {
      return false;
    }

    if (status_code < 300 || status_code >= 700) {
      throw new TypeError('Invalid status_code: '+ status_code);
    }

    request.reply(status_code, reason_phrase, extraHeaders);
  }

  // Emit 'reinvite'.
  this.emit('reinvite', data);

  if (rejected) {
    return;
  }

  if (request.body) {
    this.late_sdp = false;
    if (contentType !== 'application/sdp') {
      debug('invalid Content-Type');
      request.reply(415);
      return;
    }

    sdp = request.parseSDP();

    for (idx=0; idx < sdp.media.length; idx++) {
      m = sdp.media[idx];

      if (holdMediaTypes.indexOf(m.type) === -1) {
        continue;
      }

      direction = m.direction || sdp.direction || 'sendrecv';

      if (direction === 'sendonly' || direction === 'inactive') {
        hold = true;
      }
      // If at least one of the streams is active don't emit 'hold'.
      else {
        hold = false;
        break;
      }
    }

    var e = {originator:'remote', type:'offer', sdp:request.body};
    var offer = new RTCSessionDescription({type:'offer', sdp:e.sdp});

    this.emit('sdp', e);

    this.connection.setRemoteDescription(offer)
      .then(doAnswer)
      .catch(function(error) {
        request.reply(488);

        self.emit('peerconnection:setremotedescriptionfailed', error);
      });
  }
  else {
    this.late_sdp = true;
    doAnswer();
  }

  function doAnswer() {
    createSdp(
      // onSuccess
      function(sdp) {
        var extraHeaders = ['Contact: ' + self.contact];

        handleSessionTimersInIncomingRequest.call(self, request, extraHeaders);

        if (self.late_sdp) {
          sdp = mangleOffer.call(self, sdp);
        }

        request.reply(200, null, extraHeaders, sdp,
          function() {
            self.status = C.STATUS_WAITING_FOR_ACK;
            setInvite2xxTimer.call(self, request, sdp);
            setACKTimer.call(self);
          }
        );

        // If callback is given execute it.
        if (typeof data.callback === 'function') {
          data.callback();
        }
      },
      // onFailure
      function() {
        request.reply(500);
      }
    );
  }

  function createSdp(onSuccess, onFailure) {
    if (! self.late_sdp) {
      if (self.remoteHold === true && hold === false) {
        self.remoteHold = false;
        onunhold.call(self, 'remote');
      } else if (self.remoteHold === false && hold === true) {
        self.remoteHold = true;
        onhold.call(self, 'remote');
      }

      createLocalDescription.call(self, 'answer', onSuccess, onFailure, self.rtcAnswerConstraints);
    } else {
      createLocalDescription.call(self, 'offer', onSuccess, onFailure, self.rtcOfferConstraints);
    }
  }
}

/**
 * In dialog UPDATE Reception
 */
function receiveUpdate(request) {
  debug('receiveUpdate()');

  var
    sdp, idx, direction, m,
    self = this,
    contentType = request.getHeader('Content-Type'),
    rejected = false,
    hold = false,
    data = {
      request: request,
      callback: undefined,
      reject: reject.bind(this)
    };

  function reject(options) {
    options = options || {};
    rejected = true;

    var
      status_code = options.status_code || 403,
      reason_phrase = options.reason_phrase || '',
      extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [];

    if (this.status !== C.STATUS_CONFIRMED) {
      return false;
    }

    if (status_code < 300 || status_code >= 700) {
      throw new TypeError('Invalid status_code: '+ status_code);
    }

    request.reply(status_code, reason_phrase, extraHeaders);
  }

  // Emit 'update'.
  this.emit('update', data);

  if (rejected) {
    return;
  }

  if (! request.body) {
    var extraHeaders = [];
    handleSessionTimersInIncomingRequest.call(this, request, extraHeaders);
    request.reply(200, null, extraHeaders);
    return;
  }

  if (contentType !== 'application/sdp') {
    debug('invalid Content-Type');
    request.reply(415);
    return;
  }

  sdp = request.parseSDP();

  for (idx=0; idx < sdp.media.length; idx++) {
    m = sdp.media[idx];

    if (holdMediaTypes.indexOf(m.type) === -1) {
      continue;
    }

    direction = m.direction || sdp.direction || 'sendrecv';

    if (direction === 'sendonly' || direction === 'inactive') {
      hold = true;
    }
    // If at least one of the streams is active don't emit 'hold'.
    else {
      hold = false;
      break;
    }
  }

  var e = {originator:'remote', type:'offer', sdp:request.body};
  var offer = new RTCSessionDescription({type:'offer', sdp:e.sdp});

  this.emit('sdp', e);

  this.connection.setRemoteDescription(offer)
    .then(function() {
      if (self.remoteHold === true && hold === false) {
        self.remoteHold = false;
        onunhold.call(self, 'remote');
      } else if (self.remoteHold === false && hold === true) {
        self.remoteHold = true;
        onhold.call(self, 'remote');
      }

      createLocalDescription.call(self, 'answer',
        // success
        function(sdp) {
          var extraHeaders = ['Contact: ' + self.contact];

          handleSessionTimersInIncomingRequest.call(self, request, extraHeaders);
          request.reply(200, null, extraHeaders, sdp);

          // If callback is given execute it.
          if (typeof data.callback === 'function') {
            data.callback();
          }
        },
        // failure
        function() {
          request.reply(500);
        }
      );
    })
    .catch(function(error) {
      request.reply(488);

      self.emit('peerconnection:setremotedescriptionfailed', error);
    });
}

/**
 * In dialog Refer Reception
 */
function receiveRefer(request) {
  debug('receiveRefer()');

  var notifier,
      self = this;

  function accept(initCallback, options) {
    var session, replaces;

    options = options || {};
    initCallback = (typeof initCallback === 'function')? initCallback : null;

    if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
      return false;
    }

    session = new RTCSession(this.ua);

    session.on('progress', function(e) {
      notifier.notify(e.response.status_code, e.response.reason_phrase);
    });

    session.on('accepted', function(e) {
      notifier.notify(e.response.status_code, e.response.reason_phrase);
    });

    session.on('failed', function(e) {
      if (e.message) {
        notifier.notify(e.message.status_code, e.message.reason_phrase);
      } else {
        notifier.notify(487, e.cause);
      }
    });

    // Consider the Replaces header present in the Refer-To URI
    if (request.refer_to.uri.hasHeader('replaces')) {
      replaces = decodeURIComponent(request.refer_to.uri.getHeader('replaces'));
      options.extraHeaders = options.extraHeaders || [];
      options.extraHeaders.push('Replaces: '+ replaces);
    }

    session.connect(request.refer_to.uri.toAor(), options, initCallback);
  }

  function reject() {
    notifier.notify(603);
  }

  if (typeof request.refer_to === undefined) {
    debug('no Refer-To header field present in REFER');
    request.reply(400);
    return;
  }

  if (request.refer_to.uri.scheme !== JsSIP_C.SIP) {
    debug('Refer-To header field points to a non-SIP URI scheme');
    request.reply(416);
    return;
  }

  // reply before the transaction timer expires
  request.reply(202);

  notifier = new RTCSession_ReferNotifier(this, request.cseq);

  // Emit 'refer'.
  this.emit('refer', {
    request: request,
    accept: function(initCallback, options) { accept.call(self, initCallback, options); },
    reject: function() { reject.call(self); }
  });
}

/**
 * In dialog Notify Reception
 */
function receiveNotify(request) {
  debug('receiveNotify()');

  if (typeof request.event === undefined) {
    request.reply(400);
  }

  switch (request.event.event) {
    case 'refer': {
      var id = request.event.params.id;
      var referSubscriber = this.referSubscribers[id];

      if (!referSubscriber) {
        request.reply(481, 'Subscription does not exist');
        return;
      }

      referSubscriber.receiveNotify(request);
      request.reply(200);

      break;
    }

    default: {
      request.reply(489);
    }
  }
}

/**
 * INVITE with Replaces Reception
 */
function receiveReplaces(request) {
  debug('receiveReplaces()');

  var self = this;

  function accept(initCallback) {
    var session;

    if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
      return false;
    }

    session = new RTCSession(this.ua);

    // terminate the current session when the new one is confirmed
    session.on('confirmed', function() {
      self.terminate();
    });

    session.init_incoming(request, initCallback);
  }

  function reject() {
    debug('Replaced INVITE rejected by the user');
    request.reply(486);
  }

  // Emit 'replace'.
  this.emit('replaces', {
    request: request,
    accept: function(initCallback) { accept.call(self, initCallback); },
    reject: function() { reject.call(self); }
  });
}

/**
 * Initial Request Sender
 */
function sendInitialRequest(mediaConstraints, rtcOfferConstraints, mediaStream) {
  var self = this;
  var request_sender = new RequestSender(self, this.ua);

  this.receiveResponse = function(response) {
    receiveInviteResponse.call(self, response);
  };

  // If a local MediaStream is given use it.
  if (mediaStream) {
    // Wait a bit so the app can set events such as 'peerconnection' and 'connecting'.
    setTimeout(function() {
      userMediaSucceeded(mediaStream);
    });
  // If at least audio or video is requested prompt getUserMedia.
  } else if (mediaConstraints.audio || mediaConstraints.video) {
    this.localMediaStreamLocallyGenerated = true;
    navigator.mediaDevices.getUserMedia(mediaConstraints)
      .then(userMediaSucceeded)
      .catch(function(error)
      {
        userMediaFailed(error);

        self.emit('getusermediafailed', error);
      });
  // Otherwise don't prompt getUserMedia.
  } else {
    userMediaSucceeded(null);
  }

  // User media succeeded
  function userMediaSucceeded(stream) {
    if (self.status === C.STATUS_TERMINATED) { return; }

    self.localMediaStream = stream;
    if (stream) {
      self.connection.addStream(stream);
    }

    // Notify the app with the RTCPeerConnection so it can do stuff on it
    // before generating the offer.
    self.emit('peerconnection', {
      peerconnection: self.connection
    });

    connecting.call(self, self.request);
    createLocalDescription.call(self, 'offer', rtcSucceeded, rtcFailed, rtcOfferConstraints);
  }

  // User media failed
  function userMediaFailed() {
    if (self.status === C.STATUS_TERMINATED) { return; }

    failed.call(self, 'local', null, JsSIP_C.causes.USER_DENIED_MEDIA_ACCESS);
  }

  function rtcSucceeded(desc) {
    if (self.isCanceled || self.status === C.STATUS_TERMINATED) { return; }

    self.request.body = desc;
    self.status = C.STATUS_INVITE_SENT;

    // Emit 'sending' so the app can mangle the body before the request
    // is sent.
    self.emit('sending', {
      request: self.request
    });

    request_sender.send();
  }

  function rtcFailed() {
    if (self.status === C.STATUS_TERMINATED) { return; }

    failed.call(self, 'system', null, JsSIP_C.causes.WEBRTC_ERROR);
  }
}

/**
 * Reception of Response for Initial INVITE
 */
function receiveInviteResponse(response) {
  debug('receiveInviteResponse()');

  var cause, dialog, e,
    self = this;

  // Handle 2XX retransmissions and responses from forked requests
  if (this.dialog && (response.status_code >=200 && response.status_code <=299)) {

    /*
     * If it is a retransmission from the endpoint that established
     * the dialog, send an ACK
     */
    if (this.dialog.id.call_id === response.call_id &&
        this.dialog.id.local_tag === response.from_tag &&
        this.dialog.id.remote_tag === response.to_tag) {
      sendRequest.call(this, JsSIP_C.ACK);
      return;
    }

    // If not, send an ACK  and terminate
    else  {
      dialog = new Dialog(this, response, 'UAC');

      if (dialog.error !== undefined) {
        debug(dialog.error);
        return;
      }

      dialog.sendRequest({
          owner: {status: C.STATUS_TERMINATED},
          onRequestTimeout: function(){},
          onTransportError: function(){},
          onDialogError: function(){},
          receiveResponse: function(){}
        }, JsSIP_C.ACK);

      dialog.sendRequest({
          owner: {status: C.STATUS_TERMINATED},
          onRequestTimeout: function(){},
          onTransportError: function(){},
          onDialogError: function(){},
          receiveResponse: function(){}
        }, JsSIP_C.BYE);
      return;
    }

  }

  // Proceed to cancellation if the user requested.
  if(this.isCanceled) {
    // Remove the flag. We are done.
    this.isCanceled = false;

    if(response.status_code >= 100 && response.status_code < 200) {
      this.request.cancel(this.cancelReason);
    } else if(response.status_code >= 200 && response.status_code < 299) {
      acceptAndTerminate.call(this, response);
    }
    return;
  }

  if(this.status !== C.STATUS_INVITE_SENT && this.status !== C.STATUS_1XX_RECEIVED) {
    return;
  }

  switch(true) {
    case /^100$/.test(response.status_code):
      this.status = C.STATUS_1XX_RECEIVED;
      break;

    case /^1[0-9]{2}$/.test(response.status_code):
      // Do nothing with 1xx responses without To tag.
      if (!response.to_tag) {
        debug('1xx response received without to tag');
        break;
      }

      // Create Early Dialog if 1XX comes with contact
      if (response.hasHeader('contact')) {
        // An error on dialog creation will fire 'failed' event
        if(! createDialog.call(this, response, 'UAC', true)) {
          break;
        }
      }

      this.status = C.STATUS_1XX_RECEIVED;
      progress.call(this, 'remote', response);

      if (!response.body) {
        break;
      }

      e = {originator:'remote', type:'pranswer', sdp:response.body};
      this.emit('sdp', e);

      var pranswer = new RTCSessionDescription({type:'pranswer', sdp:e.sdp});

      this.connection.setRemoteDescription(pranswer)
        .catch(function(error) {
          self.emit('peerconnection:setremotedescriptionfailed', error);
        });
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      this.status = C.STATUS_CONFIRMED;

      if(!response.body) {
        acceptAndTerminate.call(this, response, 400, JsSIP_C.causes.MISSING_SDP);
        failed.call(this, 'remote', response, JsSIP_C.causes.BAD_MEDIA_DESCRIPTION);
        break;
      }

      // An error on dialog creation will fire 'failed' event
      if (! createDialog.call(this, response, 'UAC')) {
        break;
      }

      e = {originator:'remote', type:'answer', sdp:response.body};
      this.emit('sdp', e);

      var answer = new RTCSessionDescription({type:'answer', sdp:e.sdp});

      this.connection.setRemoteDescription(answer)
        .then(function() {
          // Handle Session Timers.
          handleSessionTimersInIncomingResponse.call(self, response);

          accepted.call(self, 'remote', response);
          sendRequest.call(self, JsSIP_C.ACK);
          confirmed.call(self, 'local', null);
        })
        .catch(function(error) {
          acceptAndTerminate.call(self, response, 488, 'Not Acceptable Here');
          failed.call(self, 'remote', response, JsSIP_C.causes.BAD_MEDIA_DESCRIPTION);

          self.emit('peerconnection:setremotedescriptionfailed', error);
        });
      break;

    default:
      cause = Utils.sipErrorCause(response.status_code);
      failed.call(this, 'remote', response, cause);
  }
}

/**
 * Send Re-INVITE
 */
function sendReinvite(options) {
  debug('sendReinvite()');

  options = options || {};

  var
    self = this,
    extraHeaders = options.extraHeaders || [],
    eventHandlers = options.eventHandlers || {},
    rtcOfferConstraints = options.rtcOfferConstraints || this.rtcOfferConstraints || null,
    succeeded = false;

  extraHeaders.push('Contact: ' + this.contact);
  extraHeaders.push('Content-Type: application/sdp');

  // Session Timers.
  if (this.sessionTimers.running) {
    extraHeaders.push('Session-Expires: ' + this.sessionTimers.currentExpires + ';refresher=' + (this.sessionTimers.refresher ? 'uac' : 'uas'));
  }

  createLocalDescription.call(this, 'offer',
    // success
    function(sdp) {
      sdp = mangleOffer.call(self, sdp);

      var request = new RTCSession_Request(self, JsSIP_C.INVITE);

      request.send({
        extraHeaders: extraHeaders,
        body: sdp,
        eventHandlers: {
          onSuccessResponse: function(response) {
            onSucceeded(response);
            succeeded = true;
          },
          onErrorResponse: function(response) {
            onFailed(response);
          },
          onTransportError: function() {
            self.onTransportError();  // Do nothing because session ends.
          },
          onRequestTimeout: function() {
            self.onRequestTimeout();  // Do nothing because session ends.
          },
          onDialogError: function() {
            self.onDialogError();  // Do nothing because session ends.
          }
        }
      });
    },
    // failure
    function() {
      onFailed();
    },
    // RTC constraints.
    rtcOfferConstraints
  );

  function onSucceeded(response) {
    if (self.status === C.STATUS_TERMINATED) {
      return;
    }

    sendRequest.call(self, JsSIP_C.ACK);

    // If it is a 2XX retransmission exit now.
    if (succeeded) { return; }

    // Handle Session Timers.
    handleSessionTimersInIncomingResponse.call(self, response);

    // Must have SDP answer.
    if(! response.body) {
      onFailed();
      return;
    } else if (response.getHeader('Content-Type') !== 'application/sdp') {
      onFailed();
      return;
    }

    var e = {originator:'remote', type:'answer', sdp:response.body};
    var answer = new RTCSessionDescription({type:'answer', sdp:e.sdp});

    self.emit('sdp', e);

    self.connection.setRemoteDescription(answer)
      .then(function() {
        if (eventHandlers.succeeded) {
          eventHandlers.succeeded(response);
        }
      })
      .catch(function(error) {
        onFailed();

        self.emit('peerconnection:setremotedescriptionfailed', error);
      });
  }

  function onFailed(response) {
    if (eventHandlers.failed) {
      eventHandlers.failed(response);
    }
  }
}

/**
 * Send UPDATE
 */
function sendUpdate(options) {
  debug('sendUpdate()');

  options = options || {};

  var
    self = this,
    extraHeaders = options.extraHeaders || [],
    eventHandlers = options.eventHandlers || {},
    rtcOfferConstraints = options.rtcOfferConstraints || this.rtcOfferConstraints || null,
    sdpOffer = options.sdpOffer || false,
    succeeded = false;

  extraHeaders.push('Contact: ' + this.contact);

  // Session Timers.
  if (this.sessionTimers.running) {
    extraHeaders.push('Session-Expires: ' + this.sessionTimers.currentExpires + ';refresher=' + (this.sessionTimers.refresher ? 'uac' : 'uas'));
  }

  if (sdpOffer) {
    extraHeaders.push('Content-Type: application/sdp');

    createLocalDescription.call(this, 'offer',
      // success
      function(sdp) {
        sdp = mangleOffer.call(self, sdp);

        var request = new RTCSession_Request(self, JsSIP_C.UPDATE);

        request.send({
          extraHeaders: extraHeaders,
          body: sdp,
          eventHandlers: {
            onSuccessResponse: function(response) {
              onSucceeded(response);
              succeeded = true;
            },
            onErrorResponse: function(response) {
              onFailed(response);
            },
            onTransportError: function() {
              self.onTransportError();  // Do nothing because session ends.
            },
            onRequestTimeout: function() {
              self.onRequestTimeout();  // Do nothing because session ends.
            },
            onDialogError: function() {
              self.onDialogError();  // Do nothing because session ends.
            }
          }
        });
      },
      // failure
      function() {
        onFailed();
      },
      // RTC constraints.
      rtcOfferConstraints
    );
  }

  // No SDP.
  else {
    var request = new RTCSession_Request(self, JsSIP_C.UPDATE);

    request.send({
      extraHeaders: extraHeaders,
      eventHandlers: {
        onSuccessResponse: function(response) {
          onSucceeded(response);
        },
        onErrorResponse: function(response) {
          onFailed(response);
        },
        onTransportError: function() {
          self.onTransportError();  // Do nothing because session ends.
        },
        onRequestTimeout: function() {
          self.onRequestTimeout();  // Do nothing because session ends.
        },
        onDialogError: function() {
          self.onDialogError();  // Do nothing because session ends.
        }
      }
    });
  }

  function onSucceeded(response) {
    if (self.status === C.STATUS_TERMINATED) {
      return;
    }

    // If it is a 2XX retransmission exit now.
    if (succeeded) { return; }

    // Handle Session Timers.
    handleSessionTimersInIncomingResponse.call(self, response);

    // Must have SDP answer.
    if (sdpOffer) {
      if(! response.body) {
        onFailed();
        return;
      } else if (response.getHeader('Content-Type') !== 'application/sdp') {
        onFailed();
        return;
      }

      var e = {originator:'remote', type:'answer', sdp:response.body};
      var answer = new RTCSessionDescription({type:'answer', sdp:e.sdp});

      self.emit('sdp', e);

      self.connection.setRemoteDescription(answer)
        .then(function() {
          if (eventHandlers.succeeded) {
            eventHandlers.succeeded(response);
          }
        })
        .catch(function(error) {
          onFailed();

          self.emit('peerconnection:setremotedescriptionfailed', error);
        });
    }
    // No SDP answer.
    else {
      if (eventHandlers.succeeded) {
        eventHandlers.succeeded(response);
      }
    }
  }

  function onFailed(response) {
    if (eventHandlers.failed) { eventHandlers.failed(response); }
  }
}

function acceptAndTerminate(response, status_code, reason_phrase) {
  debug('acceptAndTerminate()');

  var extraHeaders = [];

  if (status_code) {
    reason_phrase = reason_phrase || JsSIP_C.REASON_PHRASE[status_code] || '';
    extraHeaders.push('Reason: SIP ;cause=' + status_code + '; text="' + reason_phrase + '"');
  }

  // An error on dialog creation will fire 'failed' event
  if (this.dialog || createDialog.call(this, response, 'UAC')) {
    sendRequest.call(this, JsSIP_C.ACK);
    sendRequest.call(this, JsSIP_C.BYE, {
      extraHeaders: extraHeaders
    });
  }

  // Update session status.
  this.status = C.STATUS_TERMINATED;
}

/**
 * Send a generic in-dialog Request
 */
function sendRequest(method, options) {
  debug('sendRequest()');

  var request = new RTCSession_Request(this, method);
  request.send(options);
}

/**
 * Correctly set the SDP direction attributes if the call is on local hold
 */
function mangleOffer(sdp) {
  var idx, length, m;

  if (! this.localHold && ! this.remoteHold) {
    return sdp;
  }

  sdp = sdp_transform.parse(sdp);

  // Local hold.
  if (this.localHold && ! this.remoteHold) {
    debug('mangleOffer() | me on hold, mangling offer');
    length = sdp.media.length;
    for (idx=0; idx<length; idx++) {
      m = sdp.media[idx];
      if (holdMediaTypes.indexOf(m.type) === -1) {
        continue;
      }
      if (!m.direction) {
        m.direction = 'sendonly';
      } else if (m.direction === 'sendrecv') {
        m.direction = 'sendonly';
      } else if (m.direction === 'recvonly') {
        m.direction = 'inactive';
      }
    }
  }
  // Local and remote hold.
  else if (this.localHold && this.remoteHold) {
    debug('mangleOffer() | both on hold, mangling offer');
    length = sdp.media.length;
    for (idx=0; idx<length; idx++) {
      m = sdp.media[idx];
      if (holdMediaTypes.indexOf(m.type) === -1) {
        continue;
      }
      m.direction = 'inactive';
    }
  }
  // Remote hold.
  else if (this.remoteHold) {
    debug('mangleOffer() | remote on hold, mangling offer');
    length = sdp.media.length;
    for (idx=0; idx<length; idx++) {
      m = sdp.media[idx];
      if (holdMediaTypes.indexOf(m.type) === -1) {
        continue;
      }
      if (!m.direction) {
        m.direction = 'recvonly';
      } else if (m.direction === 'sendrecv') {
        m.direction = 'recvonly';
      } else if (m.direction === 'recvonly') {
        m.direction = 'inactive';
      }
    }
  }

  return sdp_transform.write(sdp);
}

function setLocalMediaStatus() {
  var enableAudio = true,
    enableVideo = true;

  if (this.localHold || this.remoteHold) {
    enableAudio = false;
    enableVideo = false;
  }

  if (this.audioMuted) {
    enableAudio = false;
  }

  if (this.videoMuted) {
    enableVideo = false;
  }

  toogleMuteAudio.call(this, !enableAudio);
  toogleMuteVideo.call(this, !enableVideo);
}

/**
 * Handle SessionTimers for an incoming INVITE or UPDATE.
 * @param  {IncomingRequest} request
 * @param  {Array} responseExtraHeaders  Extra headers for the 200 response.
 */
function handleSessionTimersInIncomingRequest(request, responseExtraHeaders) {
  if (! this.sessionTimers.enabled) { return; }

  var session_expires_refresher;

  if (request.session_expires && request.session_expires >= JsSIP_C.MIN_SESSION_EXPIRES) {
    this.sessionTimers.currentExpires = request.session_expires;
    session_expires_refresher = request.session_expires_refresher || 'uas';
  }
  else {
    this.sessionTimers.currentExpires = this.sessionTimers.defaultExpires;
    session_expires_refresher = 'uas';
  }

  responseExtraHeaders.push('Session-Expires: ' + this.sessionTimers.currentExpires + ';refresher=' + session_expires_refresher);

  this.sessionTimers.refresher = (session_expires_refresher === 'uas');
  runSessionTimer.call(this);
}

/**
 * Handle SessionTimers for an incoming response to INVITE or UPDATE.
 * @param  {IncomingResponse} response
 */
function handleSessionTimersInIncomingResponse(response) {
  if (! this.sessionTimers.enabled) { return; }

  var session_expires_refresher;

  if (response.session_expires && response.session_expires >= JsSIP_C.MIN_SESSION_EXPIRES) {
    this.sessionTimers.currentExpires = response.session_expires;
    session_expires_refresher = response.session_expires_refresher || 'uac';
  }
  else {
    this.sessionTimers.currentExpires = this.sessionTimers.defaultExpires;
    session_expires_refresher = 'uac';
  }

  this.sessionTimers.refresher = (session_expires_refresher === 'uac');
  runSessionTimer.call(this);
}

function runSessionTimer() {
  var self = this;
  var expires = this.sessionTimers.currentExpires;

  this.sessionTimers.running = true;

  clearTimeout(this.sessionTimers.timer);

  // I'm the refresher.
  if (this.sessionTimers.refresher) {
    this.sessionTimers.timer = setTimeout(function() {
      if (self.status === C.STATUS_TERMINATED) { return; }

      debug('runSessionTimer() | sending session refresh request');

      sendUpdate.call(self, {
        eventHandlers: {
          succeeded: function(response) {
            handleSessionTimersInIncomingResponse.call(self, response);
          }
        }
      });
    }, expires * 500);  // Half the given interval (as the RFC states).
  }

  // I'm not the refresher.
  else {
    this.sessionTimers.timer = setTimeout(function() {
      if (self.status === C.STATUS_TERMINATED) { return; }

      debugerror('runSessionTimer() | timer expired, terminating the session');

      self.terminate({
        cause: JsSIP_C.causes.REQUEST_TIMEOUT,
        status_code: 408,
        reason_phrase: 'Session Timer Expired'
      });
    }, expires * 1100);
  }
}

function toogleMuteAudio(mute) {
  var streamIdx, trackIdx, streamsLength, tracksLength, tracks,
    localStreams = this.connection.getLocalStreams();

  streamsLength = localStreams.length;
  for (streamIdx = 0; streamIdx < streamsLength; streamIdx++) {
    tracks = localStreams[streamIdx].getAudioTracks();
    tracksLength = tracks.length;
    for (trackIdx = 0; trackIdx < tracksLength; trackIdx++) {
      tracks[trackIdx].enabled = !mute;
    }
  }
}

function toogleMuteVideo(mute) {
  var streamIdx, trackIdx, streamsLength, tracksLength, tracks,
    localStreams = this.connection.getLocalStreams();

  streamsLength = localStreams.length;
  for (streamIdx = 0; streamIdx < streamsLength; streamIdx++) {
    tracks = localStreams[streamIdx].getVideoTracks();
    tracksLength = tracks.length;
    for (trackIdx = 0; trackIdx < tracksLength; trackIdx++) {
      tracks[trackIdx].enabled = !mute;
    }
  }
}

function newRTCSession(originator, request) {
  debug('newRTCSession');

  this.ua.newRTCSession({
    originator: originator,
    session: this,
    request: request
  });
}

function connecting(request) {
  debug('session connecting');

  this.emit('connecting', {
    request: request
  });
}

function progress(originator, response) {
  debug('session progress');

  this.emit('progress', {
    originator: originator,
    response: response || null
  });
}

function accepted(originator, message) {
  debug('session accepted');

  this.start_time = new Date();

  this.emit('accepted', {
    originator: originator,
    response: message || null
  });
}

function confirmed(originator, ack) {
  debug('session confirmed');

  this.is_confirmed = true;

  this.emit('confirmed', {
    originator: originator,
    ack: ack || null
  });
}

function ended(originator, message, cause) {
  debug('session ended');

  this.end_time = new Date();

  this.close();
  this.emit('ended', {
    originator: originator,
    message: message || null,
    cause: cause
  });
}

function failed(originator, message, cause) {
  debug('session failed');

  this.close();
  this.emit('failed', {
    originator: originator,
    message: message || null,
    cause: cause
  });
}

function onhold(originator) {
  debug('session onhold');

  setLocalMediaStatus.call(this);

  this.emit('hold', {
    originator: originator
  });
}

function onunhold(originator) {
  debug('session onunhold');

  setLocalMediaStatus.call(this);

  this.emit('unhold', {
    originator: originator
  });
}

function onmute(options) {
  debug('session onmute');

  setLocalMediaStatus.call(this);

  this.emit('muted', {
    audio: options.audio,
    video: options.video
  });
}

function onunmute(options) {
  debug('session onunmute');

  setLocalMediaStatus.call(this);

  this.emit('unmuted', {
    audio: options.audio,
    video: options.video
  });
}

// Plivo patch to trigger iceTimeOut
function iceTimeOut(time){
  debug('iceTimeOut() after '+ time);
  this.emit('icetimeout',time);
}
},{"./Constants":35,"./Dialog":36,"./Exceptions":39,"./RTCSession/DTMF":46,"./RTCSession/ReferNotifier":47,"./RTCSession/ReferSubscriber":48,"./RTCSession/Request":49,"./RequestSender":51,"./SIPMessage":52,"./Timers":54,"./Transactions":55,"./Utils":59,"debug":11,"events":13,"sdp-transform":17,"util":23}],46:[function(require,module,exports){
module.exports = DTMF;


var C = {
  MIN_DURATION:            70,
  MAX_DURATION:            6000,
  DEFAULT_DURATION:        100,
  MIN_INTER_TONE_GAP:      50,
  DEFAULT_INTER_TONE_GAP:  500
};

/**
 * Expose C object.
 */
DTMF.C = C;


/**
 * Dependencies.
 */
var debug = require('debug')('PlivoSIP:RTCSession:DTMF');
var debugerror = require('debug')('PlivoSIP:ERROR:RTCSession:DTMF');
debugerror.log = console.warn.bind(console);
var JsSIP_C = require('../Constants');
var Exceptions = require('../Exceptions');
var RTCSession = require('../RTCSession');


function DTMF(session) {
  this.owner = session;
  this.direction = null;
  this.tone = null;
  this.duration = null;
}


DTMF.prototype.send = function(tone, options) {
  var extraHeaders, body;

  if (tone === undefined) {
    throw new TypeError('Not enough arguments');
  }

  this.direction = 'outgoing';

  // Check RTCSession Status
  if (this.owner.status !== RTCSession.C.STATUS_CONFIRMED &&
    this.owner.status !== RTCSession.C.STATUS_WAITING_FOR_ACK) {
    throw new Exceptions.InvalidStateError(this.owner.status);
  }

  // Get DTMF options
  options = options || {};
  extraHeaders = options.extraHeaders ? options.extraHeaders.slice() : [];
  this.eventHandlers = options.eventHandlers || {};

  // Check tone type
  if (typeof tone === 'string' ) {
    tone = tone.toUpperCase();
  } else if (typeof tone === 'number') {
    tone = tone.toString();
  } else {
    throw new TypeError('Invalid tone: '+ tone);
  }

  // Check tone value
  if (!tone.match(/^[0-9A-D#*]$/)) {
    throw new TypeError('Invalid tone: '+ tone);
  } else {
    this.tone = tone;
  }

  // Duration is checked/corrected in RTCSession
  this.duration = options.duration;

  extraHeaders.push('Content-Type: application/dtmf-relay');

  body = 'Signal=' + this.tone + '\r\n';
  body += 'Duration=' + this.duration;

  this.owner.newDTMF({
    originator: 'local',
    dtmf: this,
    request: this.request
  });

  this.owner.dialog.sendRequest(this, JsSIP_C.INFO, {
    extraHeaders: extraHeaders,
    body: body
  });
};

DTMF.prototype.receiveResponse = function(response) {
  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      // Ignore provisional responses.
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      debug('onSuccessResponse');
      if (this.eventHandlers.onSuccessResponse) { this.eventHandlers.onSuccessResponse(response); }
      break;

    default:
      if (this.eventHandlers.onErrorResponse) { this.eventHandlers.onErrorResponse(response); }
      break;
  }
};

DTMF.prototype.onRequestTimeout = function() {
  debugerror('onRequestTimeout');
  if (this.eventHandlers.onRequestTimeout) { this.eventHandlers.onRequestTimeout(); }
};

DTMF.prototype.onTransportError = function() {
  debugerror('onTransportError');
  if (this.eventHandlers.onTransportError) { this.eventHandlers.onTransportError(); }
};

DTMF.prototype.onDialogError = function() {
  debugerror('onDialogError');
  if (this.eventHandlers.onDialogError) { this.eventHandlers.onDialogError(); }
};

DTMF.prototype.init_incoming = function(request) {
  var body,
    reg_tone = /^(Signal\s*?=\s*?)([0-9A-D#*]{1})(\s)?.*/,
    reg_duration = /^(Duration\s?=\s?)([0-9]{1,4})(\s)?.*/;

  this.direction = 'incoming';
  this.request = request;

  request.reply(200);

  if (request.body) {
    body = request.body.split('\n');
    if (body.length >= 1) {
      if (reg_tone.test(body[0])) {
        this.tone = body[0].replace(reg_tone,'$2');
      }
    }
    if (body.length >=2) {
      if (reg_duration.test(body[1])) {
        this.duration = parseInt(body[1].replace(reg_duration,'$2'), 10);
      }
    }
  }

  if (!this.duration) {
    this.duration = C.DEFAULT_DURATION;
  }

  if (!this.tone) {
    debug('invalid INFO DTMF received, discarded');
  } else {
    this.owner.newDTMF({
      originator: 'remote',
      dtmf: this,
      request: request
    });
  }
};

},{"../Constants":35,"../Exceptions":39,"../RTCSession":45,"debug":11}],47:[function(require,module,exports){
module.exports = ReferNotifier;


var C = {
  event_type: 'refer',
  body_type: 'message/sipfrag;version=2.0',
  expires: 300
};

/**
 * Dependencies.
 */
var debug = require('debug')('PlivoSIP:RTCSession:ReferNotifier');
var JsSIP_C = require('../Constants');
var RTCSession_Request = require('./Request');


function ReferNotifier(session, id, expires) {
  this.session = session;
  this.id = id;
  this.expires = expires || C.expires;
  this.active = true;

  // The creation of a Notifier results in an immediate NOTIFY
  this.notify(100);
}

ReferNotifier.prototype.notify = function(code, reason) {
  debug('notify()');

  var state,
      self = this;

  if (this.active === false) {
    return;
  }

  reason = reason || JsSIP_C.REASON_PHRASE[code] || '';

  if (code >= 200) {
    state = 'terminated;reason=noresource';
  } else {
    state = 'active;expires='+ this.expires;
  }

  // put this in a try/catch block
  var request = new RTCSession_Request(this.session, JsSIP_C.NOTIFY);
  request.send({
    extraHeaders: [
      'Event: '+ C.event_type +';id='+ self.id,
      'Subscription-State: '+ state,
      'Content-Type: '+ C.body_type
    ],
    body: 'SIP/2.0 ' + code + ' ' + reason,
    eventHandlers: {
      // if a negative response is received, subscription is canceled
      onErrorResponse: function() { self.active = false; }
    }
  });
};

},{"../Constants":35,"./Request":49,"debug":11}],48:[function(require,module,exports){
module.exports = ReferSubscriber;


var C = {
  expires: 120
};

/**
 * Dependencies.
 */
var util = require('util');
var events = require('events');
var debug = require('debug')('PlivoSIP:RTCSession:ReferSubscriber');
var JsSIP_C = require('../Constants');
var Grammar = require('../Grammar');
var RTCSession_Request = require('./Request');


function ReferSubscriber(session) {
  this.session = session;
  this.timer = null;
  // Instance of REFER OutgoingRequest
  this.outgoingRequest = null;

  events.EventEmitter.call(this);
}

util.inherits(ReferSubscriber, events.EventEmitter);

ReferSubscriber.prototype.sendRefer = function(target, options) {
  debug('sendRefer()');

  var extraHeaders, eventHandlers, referTo,
      replaces = null,
      self = this;

  // Get REFER options
  options = options || {};
  extraHeaders = options.extraHeaders ? options.extraHeaders.slice() : [];
  eventHandlers = options.eventHandlers || {};

  // Set event handlers
  for (var event in eventHandlers) {
    this.on(event, eventHandlers[event]);
  }

  // Replaces URI header field
  if (options.replaces) {
    replaces = options.replaces.request.call_id;
    replaces += ';to-tag='+ options.replaces.to_tag;
    replaces += ';from-tag='+ options.replaces.from_tag;

    replaces = encodeURIComponent(replaces);
  }

  // Refer-To header field
  referTo = 'Refer-To: <'+ target + (replaces?'?Replaces='+ replaces:'') +'>';

  extraHeaders.push(referTo);

  var request = new RTCSession_Request(this.session, JsSIP_C.REFER);

  this.timer = setTimeout(function() {
    removeSubscriber.call(self);
  }, C.expires * 1000);

  request.send({
    extraHeaders: extraHeaders,
    eventHandlers: {
      onSuccessResponse: function(response) {
        self.emit('requestSucceeded', {
          response: response
        });
      },
      onErrorResponse: function(response) {
        self.emit('requestFailed', {
          response: response,
          cause: JsSIP_C.causes.REJECTED
        });
      },
      onTransportError: function() {
        removeSubscriber.call(self);
        self.emit('requestFailed', {
          response: null,
          cause: JsSIP_C.causes.CONNECTION_ERROR
        });
      },
      onRequestTimeout: function() {
        removeSubscriber.call(self);
        self.emit('requestFailed', {
          response: null,
          cause: JsSIP_C.causes.REQUEST_TIMEOUT
        });
      },
      onDialogError: function() {
        removeSubscriber.call(self);
        self.emit('requestFailed', {
          response: null,
          cause: JsSIP_C.causes.DIALOG_ERROR
        });
      }
    }
  });

  this.outgoingRequest = request.outgoingRequest;
};

ReferSubscriber.prototype.receiveNotify = function(request) {
  debug('receiveNotify()');

  var status_line;

  if (!request.body) {
    return;
  }

  status_line = Grammar.parse(request.body, 'Status_Line');

  if(status_line === -1) {
    debug('receiveNotify() | error parsing NOTIFY body: "' + request.body + '"');
    return;
  }

  switch(true) {
    case /^100$/.test(status_line.status_code):
      this.emit('trying', {
        request: request,
        status_line: status_line
      });
      break;

    case /^1[0-9]{2}$/.test(status_line.status_code):
      this.emit('progress', {
        request: request,
        status_line: status_line
      });
      break;

    case /^2[0-9]{2}$/.test(status_line.status_code):
      removeSubscriber.call(this);
      this.emit('accepted', {
        request: request,
        status_line: status_line
      });
      break;

    default:
      removeSubscriber.call(this);
      this.emit('failed', {
        request: request,
        status_line: status_line
      });
      break;
  }
};

// remove refer subscriber from the session
function removeSubscriber() {
  console.log('removeSubscriber()');
  clearTimeout(this.timer);
  this.session.referSubscriber = null;
}

},{"../Constants":35,"../Grammar":40,"./Request":49,"debug":11,"events":13,"util":23}],49:[function(require,module,exports){
module.exports = Request;

/**
 * Dependencies.
 */
var debug = require('debug')('PlivoSIP:RTCSession:Request');
var debugerror = require('debug')('PlivoSIP:ERROR:RTCSession:Request');
debugerror.log = console.warn.bind(console);
var JsSIP_C = require('../Constants');
var Exceptions = require('../Exceptions');
var RTCSession = require('../RTCSession');


function Request(session, method) {
  debug('new | %s', method);

  this.session = session;
  this.method = method;
  // Instance of OutgoingRequest
  this.outgoingRequest = null;

  // Check RTCSession Status
  if (this.session.status !== RTCSession.C.STATUS_1XX_RECEIVED &&
    this.session.status !== RTCSession.C.STATUS_WAITING_FOR_ANSWER &&
    this.session.status !== RTCSession.C.STATUS_WAITING_FOR_ACK &&
    this.session.status !== RTCSession.C.STATUS_CONFIRMED &&
    this.session.status !== RTCSession.C.STATUS_TERMINATED) {
    throw new Exceptions.InvalidStateError(this.session.status);
  }

  /*
   * Allow sending BYE in TERMINATED status since the RTCSession
   * could had been terminated before the ACK had arrived.
   * RFC3261 Section 15, Paragraph 2
   */
  else if (this.session.status === RTCSession.C.STATUS_TERMINATED && method !== JsSIP_C.BYE) {
    throw new Exceptions.InvalidStateError(this.session.status);
  }
}

Request.prototype.send = function(options) {
  options = options || {};

  var
    extraHeaders = options.extraHeaders && options.extraHeaders.slice() || [],
    body = options.body || null;

  this.eventHandlers = options.eventHandlers || {};

  this.outgoingRequest = this.session.dialog.sendRequest(this, this.method, {
    extraHeaders: extraHeaders,
    body: body
  });
};

Request.prototype.receiveResponse = function(response) {
  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      debug('onProgressResponse');
      if (this.eventHandlers.onProgressResponse) { this.eventHandlers.onProgressResponse(response); }
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      debug('onSuccessResponse');
      if (this.eventHandlers.onSuccessResponse) { this.eventHandlers.onSuccessResponse(response); }
      break;

    default:
      debug('onErrorResponse');
      if (this.eventHandlers.onErrorResponse) { this.eventHandlers.onErrorResponse(response); }
      break;
  }
};

Request.prototype.onRequestTimeout = function() {
  debugerror('onRequestTimeout');
  if (this.eventHandlers.onRequestTimeout) { this.eventHandlers.onRequestTimeout(); }
};

Request.prototype.onTransportError = function() {
  debugerror('onTransportError');
  if (this.eventHandlers.onTransportError) { this.eventHandlers.onTransportError(); }
};

Request.prototype.onDialogError = function() {
  debugerror('onDialogError');
  if (this.eventHandlers.onDialogError) { this.eventHandlers.onDialogError(); }
};

},{"../Constants":35,"../Exceptions":39,"../RTCSession":45,"debug":11}],50:[function(require,module,exports){
module.exports = Registrator;


/**
 * Dependecies
 */
var debug = require('debug')('PlivoSIP:Registrator');
var Utils = require('./Utils');
var JsSIP_C = require('./Constants');
var SIPMessage = require('./SIPMessage');
var RequestSender = require('./RequestSender');


function Registrator(ua, transport) {
  var reg_id=1; //Force reg_id to 1.

  this.ua = ua;
  this.transport = transport;

  this.registrar = ua.configuration.registrar_server;
  this.expires = ua.configuration.register_expires;

  // Call-ID and CSeq values RFC3261 10.2
  this.call_id = Utils.createRandomToken(22);
  this.cseq = 0;

  // this.to_uri
  this.to_uri = ua.configuration.uri;

  this.registrationTimer = null;

  // Set status
  this.registered = false;

  // Contact header
  this.contact = this.ua.contact.toString();

  // sip.ice media feature tag (RFC 5768)
  this.contact += ';+sip.ice';

  // Custom headers for REGISTER and un-REGISTER.
  this.extraHeaders = [];

  // Custom Contact header params for REGISTER and un-REGISTER.
  this.extraContactParams = '';

  if(reg_id) {
    this.contact += ';reg-id='+ reg_id;
    this.contact += ';+sip.instance="<urn:uuid:'+ this.ua.configuration.instance_id+'>"';
  }
}


Registrator.prototype = {
  setExtraHeaders: function(extraHeaders) {
    if (! Array.isArray(extraHeaders)) {
      extraHeaders = [];
    }

    this.extraHeaders = extraHeaders.slice();
  },

  setExtraContactParams: function(extraContactParams) {
    if (! (extraContactParams instanceof Object)) {
      extraContactParams = {};
    }

    // Reset it.
    this.extraContactParams = '';

    for(var param_key in extraContactParams) {
      var param_value = extraContactParams[param_key];
      this.extraContactParams += (';' + param_key);
      if (param_value) {
        this.extraContactParams += ('=' + param_value);
      }
    }
  },

  register: function() {
    var request_sender, cause, extraHeaders,
      self = this;

    extraHeaders = this.extraHeaders.slice();
    extraHeaders.push('Contact: ' + this.contact + ';expires=' + this.expires + this.extraContactParams);
    extraHeaders.push('Expires: '+ this.expires);

    this.request = new SIPMessage.OutgoingRequest(JsSIP_C.REGISTER, this.registrar, this.ua, {
        'to_uri': this.to_uri,
        'call_id': this.call_id,
        'cseq': (this.cseq += 1)
      }, extraHeaders);

    request_sender = new RequestSender(this, this.ua);

    this.receiveResponse = function(response) {
      var contact, expires,
        contacts = response.getHeaders('contact').length;

      // Discard responses to older REGISTER/un-REGISTER requests.
      if(response.cseq !== this.cseq) {
        return;
      }

      // Clear registration timer
      if (this.registrationTimer !== null) {
        clearTimeout(this.registrationTimer);
        this.registrationTimer = null;
      }

      switch(true) {
        case /^1[0-9]{2}$/.test(response.status_code):
          // Ignore provisional responses.
          break;
        case /^2[0-9]{2}$/.test(response.status_code):
          if(response.hasHeader('expires')) {
            expires = response.getHeader('expires');
          }

          // Search the Contact pointing to us and update the expires value accordingly.
          if (!contacts) {
            debug('no Contact header in response to REGISTER, response ignored');
            break;
          }

          while(contacts--) {
            contact = response.parseHeader('contact', contacts);
            if(contact.uri.user === this.ua.contact.uri.user) {
              expires = contact.getParam('expires');
              break;
            } else {
              contact = null;
            }
          }

          if (!contact) {
            debug('no Contact header pointing to us, response ignored');
            break;
          }

          if(!expires) {
            expires = this.expires;
          }

          // Re-Register before the expiration interval has elapsed.
          // For that, decrease the expires value. ie: 3 seconds
          this.registrationTimer = setTimeout(function() {
            self.registrationTimer = null;
            self.register();
          }, (expires * 1000) - 3000);

          //Save gruu values
          if (contact.hasParam('temp-gruu')) {
            this.ua.contact.temp_gruu = contact.getParam('temp-gruu').replace(/"/g,'');
          }
          if (contact.hasParam('pub-gruu')) {
            this.ua.contact.pub_gruu = contact.getParam('pub-gruu').replace(/"/g,'');
          }

          if (! this.registered) {
            this.registered = true;
            this.ua.registered({
              response: response
            });
          }
          break;
        // Interval too brief RFC3261 10.2.8
        case /^423$/.test(response.status_code):
          if(response.hasHeader('min-expires')) {
            // Increase our registration interval to the suggested minimum
            this.expires = response.getHeader('min-expires');
            // Attempt the registration again immediately
            this.register();
          } else { //This response MUST contain a Min-Expires header field
            debug('423 response received for REGISTER without Min-Expires');
            this.registrationFailure(response, JsSIP_C.causes.SIP_FAILURE_CODE);
          }
          break;
        default:
          cause = Utils.sipErrorCause(response.status_code);
          this.registrationFailure(response, cause);
      }
    };

    this.onRequestTimeout = function() {
      this.registrationFailure(null, JsSIP_C.causes.REQUEST_TIMEOUT);
    };

    this.onTransportError = function() {
      this.registrationFailure(null, JsSIP_C.causes.CONNECTION_ERROR);
    };

    request_sender.send();
  },

  unregister: function(options) {
    var extraHeaders;

    if(!this.registered) {
      debug('already unregistered');
      return;
    }

    options = options || {};

    this.registered = false;

    // Clear the registration timer.
    if (this.registrationTimer !== null) {
      clearTimeout(this.registrationTimer);
      this.registrationTimer = null;
    }

    extraHeaders = this.extraHeaders.slice();

    if(options.all) {
      extraHeaders.push('Contact: *' + this.extraContactParams);
      extraHeaders.push('Expires: 0');

      this.request = new SIPMessage.OutgoingRequest(JsSIP_C.REGISTER, this.registrar, this.ua, {
          'to_uri': this.to_uri,
          'call_id': this.call_id,
          'cseq': (this.cseq += 1)
        }, extraHeaders);
    } else {
      extraHeaders.push('Contact: '+ this.contact + ';expires=0' + this.extraContactParams);
      extraHeaders.push('Expires: 0');

      this.request = new SIPMessage.OutgoingRequest(JsSIP_C.REGISTER, this.registrar, this.ua, {
          'to_uri': this.to_uri,
          'call_id': this.call_id,
          'cseq': (this.cseq += 1)
        }, extraHeaders);
    }

    var request_sender = new RequestSender(this, this.ua);

    this.receiveResponse = function(response) {
      var cause;

      switch(true) {
        case /^1[0-9]{2}$/.test(response.status_code):
          // Ignore provisional responses.
          break;
        case /^2[0-9]{2}$/.test(response.status_code):
          this.unregistered(response);
          break;
        default:
          cause = Utils.sipErrorCause(response.status_code);
          this.unregistered(response, cause);
      }
    };

    this.onRequestTimeout = function() {
      this.unregistered(null, JsSIP_C.causes.REQUEST_TIMEOUT);
    };

    this.onTransportError = function() {
      this.unregistered(null, JsSIP_C.causes.CONNECTION_ERROR);
    };

    request_sender.send();
  },

  registrationFailure: function(response, cause) {
    this.ua.registrationFailed({
      response: response || null,
      cause: cause
    });

    if (this.registered) {
      this.registered = false;
      this.ua.unregistered({
        response: response || null,
        cause: cause
      });
    }
  },

  unregistered: function(response, cause) {
    this.registered = false;
    this.ua.unregistered({
      response: response || null,
      cause: cause || null
    });
  },

  onTransportClosed: function() {
    if (this.registrationTimer !== null) {
      clearTimeout(this.registrationTimer);
      this.registrationTimer = null;
    }

    if(this.registered) {
      this.registered = false;
      this.ua.unregistered({});
    }
  },

  close: function() {
    if (this.registered) {
      this.unregister();
    }
  }
};


},{"./Constants":35,"./RequestSender":51,"./SIPMessage":52,"./Utils":59,"debug":11}],51:[function(require,module,exports){
module.exports = RequestSender;


/**
 * Dependencies.
 */
var debug = require('debug')('PlivoSIP:RequestSender');
var JsSIP_C = require('./Constants');
var UA = require('./UA');
var DigestAuthentication = require('./DigestAuthentication');
var Transactions = require('./Transactions');


function RequestSender(applicant, ua) {
  this.ua = ua;
  this.applicant = applicant;
  this.method = applicant.request.method;
  this.request = applicant.request;
  this.auth = null;
  this.challenged = false;
  this.staled = false;

  // If ua is in closing process or even closed just allow sending Bye and ACK
  if (ua.status === UA.C.STATUS_USER_CLOSED && (this.method !== JsSIP_C.BYE || this.method !== JsSIP_C.ACK)) {
    this.onTransportError();
  }
}


/**
* Create the client transaction and send the message.
*/
RequestSender.prototype = {
  send: function() {
    switch(this.method) {
      case 'INVITE':
        this.clientTransaction = new Transactions.InviteClientTransaction(this, this.request, this.ua.transport);
        break;
      case 'ACK':
        this.clientTransaction = new Transactions.AckClientTransaction(this, this.request, this.ua.transport);
        break;
      default:
        this.clientTransaction = new Transactions.NonInviteClientTransaction(this, this.request, this.ua.transport);
    }

    this.clientTransaction.send();
  },

  /**
  * Callback fired when receiving a request timeout error from the client transaction.
  * To be re-defined by the applicant.
  */
  onRequestTimeout: function() {
    this.applicant.onRequestTimeout();
  },

  /**
  * Callback fired when receiving a transport error from the client transaction.
  * To be re-defined by the applicant.
  */
  onTransportError: function() {
    this.applicant.onTransportError();
  },

  /**
  * Called from client transaction when receiving a correct response to the request.
  * Authenticate request if needed or pass the response back to the applicant.
  */
  receiveResponse: function(response) {
    var
      cseq, challenge, authorization_header_name,
      status_code = response.status_code;

    /*
    * Authentication
    * Authenticate once. _challenged_ flag used to avoid infinite authentications.
    */
    if ((status_code === 401 || status_code === 407) &&
        (this.ua.configuration.password !== null || this.ua.configuration.ha1 !== null)) {

      // Get and parse the appropriate WWW-Authenticate or Proxy-Authenticate header.
      if (response.status_code === 401) {
        challenge = response.parseHeader('www-authenticate');
        authorization_header_name = 'authorization';
      } else {
        challenge = response.parseHeader('proxy-authenticate');
        authorization_header_name = 'proxy-authorization';
      }

      // Verify it seems a valid challenge.
      if (!challenge) {
        debug(response.status_code + ' with wrong or missing challenge, cannot authenticate');
        this.applicant.receiveResponse(response);
        return;
      }

      if (!this.challenged || (!this.staled && challenge.stale === true)) {
        if (!this.auth) {
          this.auth = new DigestAuthentication({
            username : this.ua.configuration.authorization_user,
            password : this.ua.configuration.password,
            realm    : this.ua.configuration.realm,
            ha1      : this.ua.configuration.ha1
          });
        }

        // Verify that the challenge is really valid.
        if (!this.auth.authenticate(this.request, challenge)) {
          this.applicant.receiveResponse(response);
          return;
        }
        this.challenged = true;

        // Update ha1 and realm in the UA.
        this.ua.set('realm', this.auth.get('realm'));
        this.ua.set('ha1', this.auth.get('ha1'));

        if (challenge.stale) {
          this.staled = true;
        }

        if (response.method === JsSIP_C.REGISTER) {
          cseq = this.applicant.cseq += 1;
        } else if (this.request.dialog) {
          cseq = this.request.dialog.local_seqnum += 1;
        } else {
          cseq = this.request.cseq + 1;
        }

        this.request = this.applicant.request = this.request.clone();

        this.request.cseq = cseq;
        this.request.setHeader('cseq', cseq +' '+ this.method);

        this.request.setHeader(authorization_header_name, this.auth.toString());
        this.send();
      } else {
        this.applicant.receiveResponse(response);
      }
    } else {
      this.applicant.receiveResponse(response);
    }
  }
};

},{"./Constants":35,"./DigestAuthentication":38,"./Transactions":55,"./UA":57,"debug":11}],52:[function(require,module,exports){
module.exports = {
  OutgoingRequest: OutgoingRequest,
  IncomingRequest: IncomingRequest,
  IncomingResponse: IncomingResponse
};


/**
 * Dependencies.
 */
var debug = require('debug')('PlivoSIP:SIPMessage');
var sdp_transform = require('sdp-transform');
var JsSIP_C = require('./Constants');
var Utils = require('./Utils');
var NameAddrHeader = require('./NameAddrHeader');
var Grammar = require('./Grammar');


/**
 * -param {String} method request method
 * -param {String} ruri request uri
 * -param {UA} ua
 * -param {Object} params parameters that will have priority over ua.configuration parameters:
 * <br>
 *  - cseq, call_id, from_tag, from_uri, from_display_name, to_uri, to_tag, route_set
 * -param {Object} [headers] extra headers
 * -param {String} [body]
 */
function OutgoingRequest(method, ruri, ua, params, extraHeaders, body) {
  var
    to,
    from,
    call_id,
    cseq;

  params = params || {};

  // Mandatory parameters check
  if(!method || !ruri || !ua) {
    return null;
  }

  this.ua = ua;
  this.headers = {};
  this.method = method;
  this.ruri = ruri;
  this.body = body;
  this.extraHeaders = extraHeaders && extraHeaders.slice() || [];

  // Fill the Common SIP Request Headers

  // Route
  if (params.route_set) {
    this.setHeader('route', params.route_set);
  } else if (ua.configuration.use_preloaded_route) {
    this.setHeader('route', '<' + ua.transport.sip_uri + ';lr>');
  }

  // Via
  // Empty Via header. Will be filled by the client transaction.
  this.setHeader('via', '');

  // Max-Forwards
  this.setHeader('max-forwards', JsSIP_C.MAX_FORWARDS);

  // To
  to = (params.to_display_name || params.to_display_name === 0) ? '"' + params.to_display_name + '" ' : '';
  to += '<' + (params.to_uri || ruri) + '>';
  to += params.to_tag ? ';tag=' + params.to_tag : '';
  this.to = new NameAddrHeader.parse(to);
  this.setHeader('to', to);

  // From
  if (params.from_display_name || params.from_display_name === 0) {
    from = '"' + params.from_display_name + '" ';
  } else if (ua.configuration.display_name) {
    from = '"' + ua.configuration.display_name + '" ';
  } else {
    from = '';
  }
  from += '<' + (params.from_uri || ua.configuration.uri) + '>;tag=';
  from += params.from_tag || Utils.newTag();
  this.from = new NameAddrHeader.parse(from);
  this.setHeader('from', from);

  // Call-ID
  call_id = params.call_id || (ua.configuration.plivosip_id + Utils.createRandomToken(15));
  this.call_id = call_id;
  this.setHeader('call-id', call_id);

  // CSeq
  cseq = params.cseq || Math.floor(Math.random() * 10000);
  this.cseq = cseq;
  this.setHeader('cseq', cseq + ' ' + method);
}

OutgoingRequest.prototype = {
  /**
   * Replace the the given header by the given value.
   * -param {String} name header name
   * -param {String | Array} value header value
   */
  setHeader: function(name, value) {
    var regexp, idx;

    // Remove the header from extraHeaders if present.
    regexp = new RegExp('^\\s*'+ name +'\\s*:','i');
    for (idx=0; idx<this.extraHeaders.length; idx++) {
      if (regexp.test(this.extraHeaders[idx])) {
        this.extraHeaders.splice(idx, 1);
      }
    }

    this.headers[Utils.headerize(name)] = (Array.isArray(value)) ? value : [value];
  },

  /**
   * Get the value of the given header name at the given position.
   * -param {String} name header name
   * -returns {String|undefined} Returns the specified header, null if header doesn't exist.
   */
  getHeader: function(name) {
    var regexp, idx,
      length = this.extraHeaders.length,
      header = this.headers[Utils.headerize(name)];

    if(header) {
      if(header[0]) {
        return header[0];
      }
    } else {
      regexp = new RegExp('^\\s*'+ name +'\\s*:','i');
      for (idx=0; idx<length; idx++) {
        header = this.extraHeaders[idx];
        if (regexp.test(header)) {
          return header.substring(header.indexOf(':')+1).trim();
        }
      }
    }

    return;
  },

  /**
   * Get the header/s of the given name.
   * -param {String} name header name
   * -returns {Array} Array with all the headers of the specified name.
   */
  getHeaders: function(name) {
    var idx, length, regexp,
      header = this.headers[Utils.headerize(name)],
      result = [];

    if (header) {
      length = header.length;
      for (idx = 0; idx < length; idx++) {
        result.push(header[idx]);
      }
      return result;
    } else {
      length = this.extraHeaders.length;
      regexp = new RegExp('^\\s*'+ name +'\\s*:','i');
      for (idx=0; idx<length; idx++) {
        header = this.extraHeaders[idx];
        if (regexp.test(header)) {
          result.push(header.substring(header.indexOf(':')+1).trim());
        }
      }
      return result;
    }
  },

  /**
   * Verify the existence of the given header.
   * -param {String} name header name
   * -returns {boolean} true if header with given name exists, false otherwise
   */
  hasHeader: function(name) {
    var regexp, idx,
      length = this.extraHeaders.length;

    if (this.headers[Utils.headerize(name)]) {
      return true;
    } else {
      regexp = new RegExp('^\\s*'+ name +'\\s*:','i');
      for (idx=0; idx<length; idx++) {
        if (regexp.test(this.extraHeaders[idx])) {
          return true;
        }
      }
    }

    return false;
  },

  /**
   * Parse the current body as a SDP and store the resulting object
   * into this.sdp.
   * -param {Boolean} force: Parse even if this.sdp already exists.
   *
   * Returns this.sdp.
   */
  parseSDP: function(force) {
    if (!force && this.sdp) {
      return this.sdp;
    } else {
      this.sdp = sdp_transform.parse(this.body || '');
      return this.sdp;
    }
  },

  toString: function() {
    var msg = '', header, length, idx,
      supported = [];

    msg += this.method + ' ' + this.ruri + ' SIP/2.0\r\n';

    for (header in this.headers) {
      length = this.headers[header].length;
      for (idx = 0; idx < length; idx++) {
        msg += header + ': ' + this.headers[header][idx] + '\r\n';
      }
    }

    length = this.extraHeaders.length;
    for (idx = 0; idx < length; idx++) {
      msg += this.extraHeaders[idx].trim() +'\r\n';
    }

    // Supported
    switch (this.method) {
      case JsSIP_C.REGISTER:
        supported.push('path', 'gruu');
        break;
      case JsSIP_C.INVITE:
        if (this.ua.configuration.session_timers) {
          supported.push('timer');
        }
        if (this.ua.contact.pub_gruu || this.ua.contact.temp_gruu) {
          supported.push('gruu');
        }
        supported.push('ice','replaces');
        break;
      case JsSIP_C.UPDATE:
        if (this.ua.configuration.session_timers) {
          supported.push('timer');
        }
        supported.push('ice');
        break;
    }

    supported.push('outbound');

    // Allow
    msg += 'Allow: '+ JsSIP_C.ALLOWED_METHODS +'\r\n';
    msg += 'Supported: ' +  supported +'\r\n';
    msg += 'User-Agent: ' + 'PlivowebSDK 2.0.13' +'\r\n';

    if (this.body) {
      length = Utils.str_utf8_length(this.body);
      msg += 'Content-Length: ' + length + '\r\n\r\n';
      msg += this.body;
    } else {
      msg += 'Content-Length: 0\r\n\r\n';
    }

    return msg;
  },

  clone: function() {
    var request = new OutgoingRequest(this.method, this.ruri, this.ua);

    Object.keys(this.headers).forEach(function(name) {
      request.headers[name] = this.headers[name].slice();
    }, this);

    request.body = this.body;
    request.extraHeaders = this.extraHeaders && this.extraHeaders.slice() || [];

    request.to = this.to;
    request.from = this.from;
    request.call_id = this.call_id;
    request.cseq = this.cseq;

    return request;
  }
};


function IncomingMessage(){
  this.data = null;
  this.headers = null;
  this.method =  null;
  this.via = null;
  this.via_branch = null;
  this.call_id = null;
  this.cseq = null;
  this.from = null;
  this.from_tag = null;
  this.to = null;
  this.to_tag = null;
  this.body = null;
  this.sdp = null;
}

IncomingMessage.prototype = {
  /**
  * Insert a header of the given name and value into the last position of the
  * header array.
  */
  addHeader: function(name, value) {
    var header = { raw: value };

    name = Utils.headerize(name);

    if(this.headers[name]) {
      this.headers[name].push(header);
    } else {
      this.headers[name] = [header];
    }
  },

  /**
   * Get the value of the given header name at the given position.
   */
  getHeader: function(name) {
    var header = this.headers[Utils.headerize(name)];

    if(header) {
      if(header[0]) {
        return header[0].raw;
      }
    } else {
      return;
    }
  },

  /**
   * Get the header/s of the given name.
   */
  getHeaders: function(name) {
    var idx, length,
      header = this.headers[Utils.headerize(name)],
      result = [];

    if(!header) {
      return [];
    }

    length = header.length;
    for (idx = 0; idx < length; idx++) {
      result.push(header[idx].raw);
    }

    return result;
  },

  /**
   * Verify the existence of the given header.
   */
  hasHeader: function(name) {
    return(this.headers[Utils.headerize(name)]) ? true : false;
  },

  /**
  * Parse the given header on the given index.
  * -param {String} name header name
  * -param {Number} [idx=0] header index
  * -returns {Object|undefined} Parsed header object, undefined if the header is not present or in case of a parsing error.
  */
  parseHeader: function(name, idx) {
    var header, value, parsed;

    name = Utils.headerize(name);

    idx = idx || 0;

    if(!this.headers[name]) {
      debug('header "' + name + '" not present');
      return;
    } else if(idx >= this.headers[name].length) {
      debug('not so many "' + name + '" headers present');
      return;
    }

    header = this.headers[name][idx];
    value = header.raw;

    if(header.parsed) {
      return header.parsed;
    }

    //substitute '-' by '_' for grammar rule matching.
    parsed = Grammar.parse(value, name.replace(/-/g, '_'));

    if(parsed === -1) {
      this.headers[name].splice(idx, 1); //delete from headers
      debug('error parsing "' + name + '" header field with value "' + value + '"');
      return;
    } else {
      header.parsed = parsed;
      return parsed;
    }
  },

  /**
   * Message Header attribute selector. Alias of parseHeader.
   * -param {String} name header name
   * -param {Number} [idx=0] header index
   * -returns {Object|undefined} Parsed header object, undefined if the header is not present or in case of a parsing error.
   *
   * -example
   * message.s('via',3).port
   */
  s: function(name, idx) {
    return this.parseHeader(name, idx);
  },

  /**
  * Replace the value of the given header by the value.
  * -param {String} name header name
  * -param {String} value header value
  */
  setHeader: function(name, value) {
    var header = { raw: value };
    this.headers[Utils.headerize(name)] = [header];
  },

  /**
   * Parse the current body as a SDP and store the resulting object
   * into this.sdp.
   * -param {Boolean} force: Parse even if this.sdp already exists.
   *
   * Returns this.sdp.
   */
  parseSDP: function(force) {
    if (!force && this.sdp) {
      return this.sdp;
    } else {
      this.sdp = sdp_transform.parse(this.body || '');
      return this.sdp;
    }
  },

  toString: function() {
    return this.data;
  }
};


function IncomingRequest(ua) {
  this.ua = ua;
  this.headers = {};
  this.ruri = null;
  this.transport = null;
  this.server_transaction = null;
}

IncomingRequest.prototype = new IncomingMessage();

/**
* Stateful reply.
* -param {Number} code status code
* -param {String} reason reason phrase
* -param {Object} headers extra headers
* -param {String} body body
* -param {Function} [onSuccess] onSuccess callback
* -param {Function} [onFailure] onFailure callback
*/
IncomingRequest.prototype.reply = function(code, reason, extraHeaders, body, onSuccess, onFailure) {
  var rr, vias, length, idx, response,
    supported = [],
    to = this.getHeader('To'),
    r = 0,
    v = 0;

  code = code || null;
  reason = reason || null;

  // Validate code and reason values
  if (!code || (code < 100 || code > 699)) {
    throw new TypeError('Invalid status_code: '+ code);
  } else if (reason && typeof reason !== 'string' && !(reason instanceof String)) {
    throw new TypeError('Invalid reason_phrase: '+ reason);
  }

  reason = reason || JsSIP_C.REASON_PHRASE[code] || '';
  extraHeaders = extraHeaders && extraHeaders.slice() || [];

  response = 'SIP/2.0 ' + code + ' ' + reason + '\r\n';

  if(this.method === JsSIP_C.INVITE && code > 100 && code <= 200) {
    rr = this.getHeaders('record-route');
    length = rr.length;

    for(r; r < length; r++) {
      response += 'Record-Route: ' + rr[r] + '\r\n';
    }
  }

  vias = this.getHeaders('via');
  length = vias.length;

  for(v; v < length; v++) {
    response += 'Via: ' + vias[v] + '\r\n';
  }

  if(!this.to_tag && code > 100) {
    to += ';tag=' + Utils.newTag();
  } else if(this.to_tag && !this.s('to').hasParam('tag')) {
    to += ';tag=' + this.to_tag;
  }

  response += 'To: ' + to + '\r\n';
  response += 'From: ' + this.getHeader('From') + '\r\n';
  response += 'Call-ID: ' + this.call_id + '\r\n';
  response += 'CSeq: ' + this.cseq + ' ' + this.method + '\r\n';

  length = extraHeaders.length;
  for (idx = 0; idx < length; idx++) {
    response += extraHeaders[idx].trim() +'\r\n';
  }

  // Supported
  switch (this.method) {
    case JsSIP_C.INVITE:
      if (this.ua.configuration.session_timers) {
        supported.push('timer');
      }
      if (this.ua.contact.pub_gruu || this.ua.contact.temp_gruu) {
        supported.push('gruu');
      }
      supported.push('ice','replaces');
      break;
    case JsSIP_C.UPDATE:
      if (this.ua.configuration.session_timers) {
        supported.push('timer');
      }
      if (body) {
        supported.push('ice');
      }
      supported.push('replaces');
  }

  supported.push('outbound');

  // Allow and Accept
  if (this.method === JsSIP_C.OPTIONS) {
    response += 'Allow: '+ JsSIP_C.ALLOWED_METHODS +'\r\n';
    response += 'Accept: '+ JsSIP_C.ACCEPTED_BODY_TYPES +'\r\n';
  } else if (code === 405) {
    response += 'Allow: '+ JsSIP_C.ALLOWED_METHODS +'\r\n';
  } else if (code === 415 ) {
    response += 'Accept: '+ JsSIP_C.ACCEPTED_BODY_TYPES +'\r\n';
  }

  response += 'Supported: ' +  supported +'\r\n';

  if(body) {
    length = Utils.str_utf8_length(body);
    response += 'Content-Type: application/sdp\r\n';
    response += 'Content-Length: ' + length + '\r\n\r\n';
    response += body;
  } else {
    response += 'Content-Length: ' + 0 + '\r\n\r\n';
  }

  this.server_transaction.receiveResponse(code, response, onSuccess, onFailure);
};

/**
* Stateless reply.
* -param {Number} code status code
* -param {String} reason reason phrase
*/
IncomingRequest.prototype.reply_sl = function(code, reason) {
  var to, response,
    v = 0,
    vias = this.getHeaders('via'),
    length = vias.length;

  code = code || null;
  reason = reason || null;

  // Validate code and reason values
  if (!code || (code < 100 || code > 699)) {
    throw new TypeError('Invalid status_code: '+ code);
  } else if (reason && typeof reason !== 'string' && !(reason instanceof String)) {
    throw new TypeError('Invalid reason_phrase: '+ reason);
  }

  reason = reason || JsSIP_C.REASON_PHRASE[code] || '';

  response = 'SIP/2.0 ' + code + ' ' + reason + '\r\n';

  for(v; v < length; v++) {
    response += 'Via: ' + vias[v] + '\r\n';
  }

  to = this.getHeader('To');

  if(!this.to_tag && code > 100) {
    to += ';tag=' + Utils.newTag();
  } else if(this.to_tag && !this.s('to').hasParam('tag')) {
    to += ';tag=' + this.to_tag;
  }

  response += 'To: ' + to + '\r\n';
  response += 'From: ' + this.getHeader('From') + '\r\n';
  response += 'Call-ID: ' + this.call_id + '\r\n';
  response += 'CSeq: ' + this.cseq + ' ' + this.method + '\r\n';
  response += 'Content-Length: ' + 0 + '\r\n\r\n';

  this.transport.send(response);
};


function IncomingResponse() {
  this.headers = {};
  this.status_code = null;
  this.reason_phrase = null;
}

IncomingResponse.prototype = new IncomingMessage();

},{"./Constants":35,"./Grammar":40,"./NameAddrHeader":43,"./Utils":59,"debug":11,"sdp-transform":17}],53:[function(require,module,exports){
module.exports = Socket;

/**
 * Interface documentation: http://jssip.net/documentation/$last_version/api/socket/
 *
 * interface Socket {
 *  attribute String via_transport
 *  attribute String url
 *  attribute String sip_uri
 *
 *  method connect();
 *  method disconnect();
 *  method send(data);
 *
 *  attribute EventHandler onconnect
 *  attribute EventHandler ondisconnect
 *  attribute EventHandler ondata
 * }
 *
 */


/**
 * Dependencies.
 */
var Utils = require('./Utils');
var Grammar = require('./Grammar');
var debugerror = require('debug')('PlivoSIP:ERROR:Socket');
debugerror.log = console.warn.bind(console);

function Socket() {}

Socket.isSocket = function(socket) {
  // Ignore if an array is given
  if (Array.isArray(socket)) {
    return false;
  }

  if (typeof socket === 'undefined') {
    debugerror('undefined JsSIP.Socket instance');
    return false;
  }

  // Check Properties
  try {
    if (!Utils.isString(socket.url)) {
      debugerror('missing or invalid JsSIP.Socket url property');
      throw new Error();
    }

    if (!Utils.isString(socket.via_transport)) {
      debugerror('missing or invalid JsSIP.Socket via_transport property');
      throw new Error();
    }

    if (Grammar.parse(socket.sip_uri, 'SIP_URI') === -1) {
      debugerror('missing or invalid JsSIP.Socket sip_uri property');
      throw new Error();
    }
  } catch(e) {
    return false;
  }

  // Check Methods
  try {
    ['connect', 'disconnect', 'send'].forEach(function(method) {
      if (!Utils.isFunction(socket[method])) {
        debugerror('missing or invalid JsSIP.Socket method: ' + method);
        throw new Error();
      }
    });
  } catch(e) {
    return false;
  }

  return true;
};

},{"./Grammar":40,"./Utils":59,"debug":11}],54:[function(require,module,exports){
var T1 = 500,
  T2 = 4000,
  T4 = 5000;


var Timers = {
  T1: T1,
  T2: T2,
  T4: T4,
  TIMER_B: 64 * T1,
  TIMER_D: 0  * T1,
  TIMER_F: 64 * T1,
  TIMER_H: 64 * T1,
  TIMER_I: 0  * T1,
  TIMER_J: 0  * T1,
  TIMER_K: 0  * T4,
  TIMER_L: 64 * T1,
  TIMER_M: 64 * T1,
  PROVISIONAL_RESPONSE_INTERVAL: 60000  // See RFC 3261 Section 13.3.1.1
};


module.exports = Timers;

},{}],55:[function(require,module,exports){
module.exports = {
  C: null,
  NonInviteClientTransaction: NonInviteClientTransaction,
  InviteClientTransaction: InviteClientTransaction,
  AckClientTransaction: AckClientTransaction,
  NonInviteServerTransaction: NonInviteServerTransaction,
  InviteServerTransaction: InviteServerTransaction,
  checkTransaction: checkTransaction
};


var C = {
  // Transaction states
  STATUS_TRYING:     1,
  STATUS_PROCEEDING: 2,
  STATUS_CALLING:    3,
  STATUS_ACCEPTED:   4,
  STATUS_COMPLETED:  5,
  STATUS_TERMINATED: 6,
  STATUS_CONFIRMED:  7,

  // Transaction types
  NON_INVITE_CLIENT: 'nict',
  NON_INVITE_SERVER: 'nist',
  INVITE_CLIENT: 'ict',
  INVITE_SERVER: 'ist'
};

/**
 * Expose C object.
 */
module.exports.C = C;


/**
 * Dependencies.
 */
var util = require('util');
var events = require('events');
var debugnict = require('debug')('PlivoSIP:NonInviteClientTransaction');
var debugict = require('debug')('PlivoSIP:InviteClientTransaction');
var debugact = require('debug')('PlivoSIP:AckClientTransaction');
var debugnist = require('debug')('PlivoSIP:NonInviteServerTransaction');
var debugist = require('debug')('PlivoSIP:InviteServerTransaction');
var JsSIP_C = require('./Constants');
var Timers = require('./Timers');


function NonInviteClientTransaction(request_sender, request, transport) {
  var via;

  this.type = C.NON_INVITE_CLIENT;
  this.transport = transport;
  this.id = 'z9hG4bK' + Math.floor(Math.random() * 10000000);
  this.request_sender = request_sender;
  this.request = request;

  via = 'SIP/2.0/' + transport.via_transport;
  via += ' ' + request_sender.ua.configuration.via_host + ';branch=' + this.id;

  this.request.setHeader('via', via);

  this.request_sender.ua.newTransaction(this);

  events.EventEmitter.call(this);
}

util.inherits(NonInviteClientTransaction, events.EventEmitter);

NonInviteClientTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

NonInviteClientTransaction.prototype.send = function() {
  var tr = this;

  this.stateChanged(C.STATUS_TRYING);
  this.F = setTimeout(function() {tr.timer_F();}, Timers.TIMER_F);

  if(!this.transport.send(this.request)) {
    this.onTransportError();
  }
};

NonInviteClientTransaction.prototype.onTransportError = function() {
  debugnict('transport error occurred, deleting transaction ' + this.id);
  clearTimeout(this.F);
  clearTimeout(this.K);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
  this.request_sender.onTransportError();
};

NonInviteClientTransaction.prototype.timer_F = function() {
  debugnict('Timer F expired for transaction ' + this.id);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
  this.request_sender.onRequestTimeout();
};

NonInviteClientTransaction.prototype.timer_K = function() {
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
};

NonInviteClientTransaction.prototype.receiveResponse = function(response) {
  var
    tr = this,
    status_code = response.status_code;

  if(status_code < 200) {
    switch(this.state) {
      case C.STATUS_TRYING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_PROCEEDING);
        this.request_sender.receiveResponse(response);
        break;
    }
  } else {
    switch(this.state) {
      case C.STATUS_TRYING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_COMPLETED);
        clearTimeout(this.F);

        if(status_code === 408) {
          this.request_sender.onRequestTimeout();
        } else {
          this.request_sender.receiveResponse(response);
        }

        this.K = setTimeout(function() {tr.timer_K();}, Timers.TIMER_K);
        break;
      case C.STATUS_COMPLETED:
        break;
    }
  }
};


function InviteClientTransaction(request_sender, request, transport) {
  var via,
    tr = this;

  this.type = C.INVITE_CLIENT;
  this.transport = transport;
  this.id = 'z9hG4bK' + Math.floor(Math.random() * 10000000);
  this.request_sender = request_sender;
  this.request = request;

  via = 'SIP/2.0/' + transport.via_transport;
  via += ' ' + request_sender.ua.configuration.via_host + ';branch=' + this.id;

  this.request.setHeader('via', via);

  this.request_sender.ua.newTransaction(this);

  // TODO: Adding here the cancel() method is a hack that must be fixed.
  // Add the cancel property to the request.
  //Will be called from the request instance, not the transaction itself.
  this.request.cancel = function(reason) {
    tr.cancel_request(tr, reason);
  };

  events.EventEmitter.call(this);
}

util.inherits(InviteClientTransaction, events.EventEmitter);

InviteClientTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

InviteClientTransaction.prototype.send = function() {
  var tr = this;
  this.stateChanged(C.STATUS_CALLING);
  this.B = setTimeout(function() {
    tr.timer_B();
  }, Timers.TIMER_B);

  if(!this.transport.send(this.request)) {
    this.onTransportError();
  }
};

InviteClientTransaction.prototype.onTransportError = function() {
  clearTimeout(this.B);
  clearTimeout(this.D);
  clearTimeout(this.M);

  if (this.state !== C.STATUS_ACCEPTED) {
    debugict('transport error occurred, deleting transaction ' + this.id);
    this.request_sender.onTransportError();
  }

  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
};

// RFC 6026 7.2
InviteClientTransaction.prototype.timer_M = function() {
  debugict('Timer M expired for transaction ' + this.id);

  if(this.state === C.STATUS_ACCEPTED) {
    clearTimeout(this.B);
    this.stateChanged(C.STATUS_TERMINATED);
    this.request_sender.ua.destroyTransaction(this);
  }
};

// RFC 3261 17.1.1
InviteClientTransaction.prototype.timer_B = function() {
  debugict('Timer B expired for transaction ' + this.id);
  if(this.state === C.STATUS_CALLING) {
    this.stateChanged(C.STATUS_TERMINATED);
    this.request_sender.ua.destroyTransaction(this);
    this.request_sender.onRequestTimeout();
  }
};

InviteClientTransaction.prototype.timer_D = function() {
  debugict('Timer D expired for transaction ' + this.id);
  clearTimeout(this.B);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
};

InviteClientTransaction.prototype.sendACK = function(response) {
  var tr = this;

  this.ack = 'ACK ' + this.request.ruri + ' SIP/2.0\r\n';
  this.ack += 'Via: ' + this.request.headers.Via.toString() + '\r\n';

  if(this.request.headers.Route) {
    this.ack += 'Route: ' + this.request.headers.Route.toString() + '\r\n';
  }

  this.ack += 'To: ' + response.getHeader('to') + '\r\n';
  this.ack += 'From: ' + this.request.headers.From.toString() + '\r\n';
  this.ack += 'Call-ID: ' + this.request.headers['Call-ID'].toString() + '\r\n';
  this.ack += 'CSeq: ' + this.request.headers.CSeq.toString().split(' ')[0];
  this.ack += ' ACK\r\n';
  this.ack += 'Content-Length: 0\r\n\r\n';

  this.D = setTimeout(function() {tr.timer_D();}, Timers.TIMER_D);

  this.transport.send(this.ack);
};

InviteClientTransaction.prototype.cancel_request = function(tr, reason) {
  var request = tr.request;

  this.cancel = JsSIP_C.CANCEL + ' ' + request.ruri + ' SIP/2.0\r\n';
  this.cancel += 'Via: ' + request.headers.Via.toString() + '\r\n';

  if(this.request.headers.Route) {
    this.cancel += 'Route: ' + request.headers.Route.toString() + '\r\n';
  }

  this.cancel += 'To: ' + request.headers.To.toString() + '\r\n';
  this.cancel += 'From: ' + request.headers.From.toString() + '\r\n';
  this.cancel += 'Call-ID: ' + request.headers['Call-ID'].toString() + '\r\n';
  this.cancel += 'CSeq: ' + request.headers.CSeq.toString().split(' ')[0] +
  ' CANCEL\r\n';

  if(reason) {
    this.cancel += 'Reason: ' + reason + '\r\n';
  }

  this.cancel += 'Content-Length: 0\r\n\r\n';

  // Send only if a provisional response (>100) has been received.
  if(this.state === C.STATUS_PROCEEDING) {
    this.transport.send(this.cancel);
  }
};

InviteClientTransaction.prototype.receiveResponse = function(response) {
  var
  tr = this,
  status_code = response.status_code;

  if(status_code >= 100 && status_code <= 199) {
    switch(this.state) {
      case C.STATUS_CALLING:
        this.stateChanged(C.STATUS_PROCEEDING);
        this.request_sender.receiveResponse(response);
        break;
      case C.STATUS_PROCEEDING:
        this.request_sender.receiveResponse(response);
        break;
    }
  } else if(status_code >= 200 && status_code <= 299) {
    switch(this.state) {
      case C.STATUS_CALLING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_ACCEPTED);
        this.M = setTimeout(function() {
          tr.timer_M();
        }, Timers.TIMER_M);
        this.request_sender.receiveResponse(response);
        break;
      case C.STATUS_ACCEPTED:
        this.request_sender.receiveResponse(response);
        break;
    }
  } else if(status_code >= 300 && status_code <= 699) {
    switch(this.state) {
      case C.STATUS_CALLING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_COMPLETED);
        this.sendACK(response);
        this.request_sender.receiveResponse(response);
        break;
      case C.STATUS_COMPLETED:
        this.sendACK(response);
        break;
    }
  }
};


function AckClientTransaction(request_sender, request, transport) {
  var via;

  this.transport = transport;
  this.id = 'z9hG4bK' + Math.floor(Math.random() * 10000000);
  this.request_sender = request_sender;
  this.request = request;

  via = 'SIP/2.0/' + transport.via_transport;
  via += ' ' + request_sender.ua.configuration.via_host + ';branch=' + this.id;

  this.request.setHeader('via', via);

  events.EventEmitter.call(this);
}

util.inherits(AckClientTransaction, events.EventEmitter);

AckClientTransaction.prototype.send = function() {
  if(!this.transport.send(this.request)) {
    this.onTransportError();
  }
};

AckClientTransaction.prototype.onTransportError = function() {
  debugact('transport error occurred for transaction ' + this.id);
  this.request_sender.onTransportError();
};


function NonInviteServerTransaction(request, ua) {
  this.type = C.NON_INVITE_SERVER;
  this.id = request.via_branch;
  this.request = request;
  this.transport = request.transport;
  this.ua = ua;
  this.last_response = '';
  request.server_transaction = this;

  this.state = C.STATUS_TRYING;

  ua.newTransaction(this);

  events.EventEmitter.call(this);
}

util.inherits(NonInviteServerTransaction, events.EventEmitter);

NonInviteServerTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

NonInviteServerTransaction.prototype.timer_J = function() {
  debugnist('Timer J expired for transaction ' + this.id);
  this.stateChanged(C.STATUS_TERMINATED);
  this.ua.destroyTransaction(this);
};

NonInviteServerTransaction.prototype.onTransportError = function() {
  if (!this.transportError) {
    this.transportError = true;

    debugnist('transport error occurred, deleting transaction ' + this.id);

    clearTimeout(this.J);
    this.stateChanged(C.STATUS_TERMINATED);
    this.ua.destroyTransaction(this);
  }
};

NonInviteServerTransaction.prototype.receiveResponse = function(status_code, response, onSuccess, onFailure) {
  var tr = this;

  if(status_code === 100) {
    /* RFC 4320 4.1
     * 'A SIP element MUST NOT
     * send any provisional response with a
     * Status-Code other than 100 to a non-INVITE request.'
     */
    switch(this.state) {
      case C.STATUS_TRYING:
        this.stateChanged(C.STATUS_PROCEEDING);
        if(!this.transport.send(response))  {
          this.onTransportError();
        }
        break;
      case C.STATUS_PROCEEDING:
        this.last_response = response;
        if(!this.transport.send(response)) {
          this.onTransportError();
          if (onFailure) {
            onFailure();
          }
        } else if (onSuccess) {
          onSuccess();
        }
        break;
    }
  } else if(status_code >= 200 && status_code <= 699) {
    switch(this.state) {
      case C.STATUS_TRYING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_COMPLETED);
        this.last_response = response;
        this.J = setTimeout(function() {
          tr.timer_J();
        }, Timers.TIMER_J);
        if(!this.transport.send(response)) {
          this.onTransportError();
          if (onFailure) {
            onFailure();
          }
        } else if (onSuccess) {
          onSuccess();
        }
        break;
      case C.STATUS_COMPLETED:
        break;
    }
  }
};


function InviteServerTransaction(request, ua) {
  this.type = C.INVITE_SERVER;
  this.id = request.via_branch;
  this.request = request;
  this.transport = request.transport;
  this.ua = ua;
  this.last_response = '';
  request.server_transaction = this;

  this.state = C.STATUS_PROCEEDING;

  ua.newTransaction(this);

  this.resendProvisionalTimer = null;

  request.reply(100);

  events.EventEmitter.call(this);
}

util.inherits(InviteServerTransaction, events.EventEmitter);

InviteServerTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

InviteServerTransaction.prototype.timer_H = function() {
  debugist('Timer H expired for transaction ' + this.id);

  if(this.state === C.STATUS_COMPLETED) {
    debugist('ACK not received, dialog will be terminated');
  }

  this.stateChanged(C.STATUS_TERMINATED);
  this.ua.destroyTransaction(this);
};

InviteServerTransaction.prototype.timer_I = function() {
  this.stateChanged(C.STATUS_TERMINATED);
};

// RFC 6026 7.1
InviteServerTransaction.prototype.timer_L = function() {
  debugist('Timer L expired for transaction ' + this.id);

  if(this.state === C.STATUS_ACCEPTED) {
    this.stateChanged(C.STATUS_TERMINATED);
    this.ua.destroyTransaction(this);
  }
};

InviteServerTransaction.prototype.onTransportError = function() {
  if (!this.transportError) {
    this.transportError = true;

    debugist('transport error occurred, deleting transaction ' + this.id);

    if (this.resendProvisionalTimer !== null) {
      clearInterval(this.resendProvisionalTimer);
      this.resendProvisionalTimer = null;
    }

    clearTimeout(this.L);
    clearTimeout(this.H);
    clearTimeout(this.I);

    this.stateChanged(C.STATUS_TERMINATED);
    this.ua.destroyTransaction(this);
  }
};

InviteServerTransaction.prototype.resend_provisional = function() {
  if(!this.transport.send(this.last_response)) {
    this.onTransportError();
  }
};

// INVITE Server Transaction RFC 3261 17.2.1
InviteServerTransaction.prototype.receiveResponse = function(status_code, response, onSuccess, onFailure) {
  var tr = this;

  if(status_code >= 100 && status_code <= 199) {
    switch(this.state) {
      case C.STATUS_PROCEEDING:
        if(!this.transport.send(response)) {
          this.onTransportError();
        }
        this.last_response = response;
        break;
    }
  }

  if(status_code > 100 && status_code <= 199 && this.state === C.STATUS_PROCEEDING) {
    // Trigger the resendProvisionalTimer only for the first non 100 provisional response.
    if(this.resendProvisionalTimer === null) {
      this.resendProvisionalTimer = setInterval(function() {
        tr.resend_provisional();}, Timers.PROVISIONAL_RESPONSE_INTERVAL);
    }
  } else if(status_code >= 200 && status_code <= 299) {
    switch(this.state) {
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_ACCEPTED);
        this.last_response = response;
        this.L = setTimeout(function() {
          tr.timer_L();
        }, Timers.TIMER_L);

        if (this.resendProvisionalTimer !== null) {
          clearInterval(this.resendProvisionalTimer);
          this.resendProvisionalTimer = null;
        }
        /* falls through */
        case C.STATUS_ACCEPTED:
          // Note that this point will be reached for proceeding tr.state also.
          if(!this.transport.send(response)) {
            this.onTransportError();
            if (onFailure) {
              onFailure();
            }
          } else if (onSuccess) {
            onSuccess();
          }
          break;
    }
  } else if(status_code >= 300 && status_code <= 699) {
    switch(this.state) {
      case C.STATUS_PROCEEDING:
        if (this.resendProvisionalTimer !== null) {
          clearInterval(this.resendProvisionalTimer);
          this.resendProvisionalTimer = null;
        }

        if(!this.transport.send(response)) {
          this.onTransportError();
          if (onFailure) {
            onFailure();
          }
        } else {
          this.stateChanged(C.STATUS_COMPLETED);
          this.H = setTimeout(function() {
            tr.timer_H();
          }, Timers.TIMER_H);
          if (onSuccess) {
            onSuccess();
          }
        }
        break;
    }
  }
};

/**
 * INVITE:
 *  _true_ if retransmission
 *  _false_ new request
 *
 * ACK:
 *  _true_  ACK to non2xx response
 *  _false_ ACK must be passed to TU (accepted state)
 *          ACK to 2xx response
 *
 * CANCEL:
 *  _true_  no matching invite transaction
 *  _false_ matching invite transaction and no final response sent
 *
 * OTHER:
 *  _true_  retransmission
 *  _false_ new request
 */
function checkTransaction(ua, request) {
  var tr;

  switch(request.method) {
    case JsSIP_C.INVITE:
      tr = ua.transactions.ist[request.via_branch];
      if(tr) {
        switch(tr.state) {
          case C.STATUS_PROCEEDING:
            tr.transport.send(tr.last_response);
            break;

            // RFC 6026 7.1 Invite retransmission
            //received while in C.STATUS_ACCEPTED state. Absorb it.
          case C.STATUS_ACCEPTED:
            break;
        }
        return true;
      }
      break;
    case JsSIP_C.ACK:
      tr = ua.transactions.ist[request.via_branch];

      // RFC 6026 7.1
      if(tr) {
        if(tr.state === C.STATUS_ACCEPTED) {
          return false;
        } else if(tr.state === C.STATUS_COMPLETED) {
          tr.state = C.STATUS_CONFIRMED;
          tr.I = setTimeout(function() {tr.timer_I();}, Timers.TIMER_I);
          return true;
        }
      }
      // ACK to 2XX Response.
      else {
        return false;
      }
      break;
    case JsSIP_C.CANCEL:
      tr = ua.transactions.ist[request.via_branch];
      if(tr) {
        request.reply_sl(200);
        if(tr.state === C.STATUS_PROCEEDING) {
          return false;
        } else {
          return true;
        }
      } else {
        request.reply_sl(481);
        return true;
      }
      break;
    default:

      // Non-INVITE Server Transaction RFC 3261 17.2.2
      tr = ua.transactions.nist[request.via_branch];
      if(tr) {
        switch(tr.state) {
          case C.STATUS_TRYING:
            break;
          case C.STATUS_PROCEEDING:
          case C.STATUS_COMPLETED:
            tr.transport.send(tr.last_response);
            break;
        }
        return true;
      }
      break;
  }
}

},{"./Constants":35,"./Timers":54,"debug":11,"events":13,"util":23}],56:[function(require,module,exports){
module.exports = Transport;

/**
 * Dependencies.
 */
var Socket = require('./Socket');
var debug = require('debug')('PlivoSIP:Transport');
var debugerror = require('debug')('PlivoSIP:ERROR:Transport');

/**
 * Constants
 */
var C = {
  // Transport status
  STATUS_CONNECTED:           0,
  STATUS_CONNECTING:          1,
  STATUS_DISCONNECTED:        2,

  // Socket status
  SOCKET_STATUS_READY:        0,
  SOCKET_STATUS_ERROR:        1,

  // Recovery options
  recovery_options: {
    min_interval: 2, // minimum interval in seconds between recover attempts
    max_interval: 30 // maximum interval in seconds between recover attempts
  }
};

/*
 * Manages one or multiple JsSIP.Socket instances.
 * Is reponsible for transport recovery logic among all socket instances.
 *
 * @socket JsSIP::Socket instance
 */

function Transport(sockets, recovery_options) {
  debug('new()');

  this.status = C.STATUS_DISCONNECTED;

  // current socket
  this.socket = null;

  // socket collection
  this.sockets = [];

  this.recovery_options = recovery_options || C.recovery_options;
  this.recover_attempts = 0;
  this.recovery_timer = null;

  this.close_requested = false;

  if (typeof sockets === 'undefined') {
    throw new TypeError('Invalid argument.' +
                        ' undefined \'sockets\' argument');
  }

  if (!(sockets instanceof Array)) {
    sockets = [ sockets ];
  }

  sockets.forEach(function(socket) {
    if (!Socket.isSocket(socket.socket)) {
      throw new TypeError('Invalid argument.' +
                          ' invalid \'JsSIP.Socket\' instance');
    }

    if (socket.weight && !Number(socket.weight)) {
      throw new TypeError('Invalid argument.' +
                          ' \'weight\' attribute is not a number');
    }

    this.sockets.push({
      socket: socket.socket,
      weight: socket.weight || 0,
      status: C.SOCKET_STATUS_READY
    });
  }, this);

  // read only properties
  Object.defineProperties(this, {
    via_transport:   { get: function() { return this.socket.via_transport; } },
    url:      { get: function() { return this.socket.url;       } },
    sip_uri:  { get: function() { return this.socket.sip_uri;   } }
  });

  // get the socket with higher weight
  getSocket.call(this);
}

/**
 * Instance Methods
 */

Transport.prototype.connect = function() {
  debug('connect()');

  if (this.isConnected()) {
    debug('Transport is already connected');
    return;
  } else if (this.isConnecting()) {
    debug('Transport is connecting');
    return;
  }

  this.close_requested = false;
  this.status = C.STATUS_CONNECTING;
  this.onconnecting({ socket:this.socket, attempts:this.recover_attempts });

  if (!this.close_requested) {
    // bind socket event callbacks
    this.socket.onconnect     = onConnect.bind(this);
    this.socket.ondisconnect  = onDisconnect.bind(this);
    this.socket.ondata        = onData.bind(this);

    this.socket.connect();
  }

  return;
};

Transport.prototype.disconnect = function() {
  debug('close()');

  this.close_requested = true;
  this.recover_attempts = 0;
  this.status = C.STATUS_DISCONNECTED;

  // clear recovery_timer
  if (this.recovery_timer !== null) {
    clearTimeout(this.recovery_timer);
    this.recovery_timer = null;
  }

  // unbind socket event callbacks
  this.socket.onconnect     = function() {};
  this.socket.ondisconnect  = function() {};
  this.socket.ondata        = function() {};

  this.socket.disconnect();
  this.ondisconnect();
};

Transport.prototype.send = function(data) {
  debug('send()');

  if (!this.isConnected()) {
    debugerror('unable to send message, transport is not connected');
    return false;
  }

  var message = data.toString();

  debug('sending message:\n\n' + message + '\n');
  return this.socket.send(message);
};

Transport.prototype.isConnected = function() {
  return this.status === C.STATUS_CONNECTED;
};

Transport.prototype.isConnecting = function() {
  return this.status === C.STATUS_CONNECTING;
};

/**
 * Socket Event Handlers
 */

function onConnect() {
  this.recover_attempts = 0;
  this.status = C.STATUS_CONNECTED;

  // clear recovery_timer
  if (this.recovery_timer !== null) {
    clearTimeout(this.recovery_timer);
    this.recovery_timer = null;
  }

  this.onconnect( {socket:this} );
}

function onDisconnect(error, code, reason) {
  this.status = C.STATUS_DISCONNECTED;
  this.ondisconnect({ socket:this.socket, error:error, code:code, reason:reason });

  if (this.close_requested) {
    return;
  }

  // update socket status
  if (error) {
    this.socket.status = C.SOCKET_STATUS_ERROR;
  }

  reconnect.call(this, error);
}

function onData(data) {
  // CRLF Keep Alive response from server. Ignore it.
  if(data === '\r\n') {
    debug('received message with CRLF Keep Alive response');
    return;
  }

  // binary message.
  else if (typeof data !== 'string') {
    try {
      data = String.fromCharCode.apply(null, new Uint8Array(data));
    } catch(evt) {
      debug('received binary message failed to be converted into string,' +
            ' message discarded');
      return;
    }

    debug('received binary message:\n\n' + data + '\n');
  }

  // text message.
  else {
    debug('received text message:\n\n' + data + '\n');
  }

  this.ondata({ transport:this, message:data });
}

function reconnect() {
  var k,
  self = this;

  this.recover_attempts+=1;

  k = Math.floor((Math.random() * Math.pow(2,this.recover_attempts)) +1);

  if (k < this.recovery_options.min_interval) {
    k = this.recovery_options.min_interval;
  }

  else if (k > this.recovery_options.max_interval) {
    k = this.recovery_options.max_interval;
  }

  debug('reconnection attempt: '+ this.recover_attempts +
        '. next connection attempt in '+ k +' seconds');

  this.recovery_timer = setTimeout(function() {
    if (!self.close_requested && !(self.isConnected() || self.isConnecting())) {
      // get the next available socket with higher weight
      getSocket.call(self);

      // connect the socket
      self.connect();
    }
  }, k * 1000);
}

/**
 * get the next available socket with higher weight
 */
function getSocket() {

  var candidates = [];

  this.sockets.forEach(function(socket) {
    if (socket.status === C.SOCKET_STATUS_ERROR) {
      return; // continue the array iteration
    } else if (candidates.length === 0) {
      candidates.push(socket);
    } else if (socket.weight > candidates[0].weight) {
      candidates = [socket];
    } else if (socket.weight === candidates[0].weight) {
      candidates.push(socket);
    }
  });

  if (candidates.length === 0) {
    // all sockets have failed. reset sockets status
    this.sockets.forEach(function(socket) {
      socket.status = C.SOCKET_STATUS_READY;
    });

    // get next available socket
    getSocket.call(this);
    return;
  }

  var idx = Math.floor((Math.random()* candidates.length));
  this.socket = candidates[idx].socket;
}

},{"./Socket":53,"debug":11}],57:[function(require,module,exports){
module.exports = UA;


var C = {
  // UA status codes
  STATUS_INIT :                0,
  STATUS_READY:                1,
  STATUS_USER_CLOSED:          2,
  STATUS_NOT_READY:            3,

  // UA error codes
  CONFIGURATION_ERROR:  1,
  NETWORK_ERROR:        2
};

/**
 * Expose C object.
 */
UA.C = C;


/**
 * Dependencies.
 */
var util = require('util');
var events = require('events');
var debug = require('debug')('PlivoSIP:UA');
var debugerror = require('debug')('PlivoSIP:ERROR:UA');
debugerror.log = console.warn.bind(console);
var JsSIP_C = require('./Constants');
var Registrator = require('./Registrator');
var RTCSession = require('./RTCSession');
var Message = require('./Message');
var Transactions = require('./Transactions');
var Transport = require('./Transport');
var Socket = require('./Socket');
var Utils = require('./Utils');
var Exceptions = require('./Exceptions');
var URI = require('./URI');
var Grammar = require('./Grammar');
var Parser = require('./Parser');
var SIPMessage = require('./SIPMessage');
var sanityCheck = require('./sanityCheck');



/**
 * The User-Agent class.
 * @class JsSIP.UA
 * @param {Object} configuration Configuration parameters.
 * @throws {JsSIP.Exceptions.ConfigurationError} If a configuration parameter is invalid.
 * @throws {TypeError} If no configuration is given.
 */
function UA(configuration) {
  

  this.cache = {
    credentials: {}
  };

  this.configuration = {};
  this.dynConfiguration = {};
  this.dialogs = {};

  //User actions outside any session/dialog (MESSAGE)
  this.applicants = {};

  this.sessions = {};
  this.transport = null;
  this.contact = null;
  this.status = C.STATUS_INIT;
  this.error = null;
  this.transactions = {
    nist: {},
    nict: {},
    ist: {},
    ict: {}
  };

  // Custom UA empty object for high level use
  this.data = {};

  this.closeTimer = null;

  Object.defineProperties(this, {
    transactionsCount: {
      get: function() {
        var type,
          transactions = ['nist','nict','ist','ict'],
          count = 0;

        for (type in transactions) {
          count += Object.keys(this.transactions[transactions[type]]).length;
        }

        return count;
      }
    },

    nictTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions.nict).length;
      }
    },

    nistTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions.nist).length;
      }
    },

    ictTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions.ict).length;
      }
    },

    istTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions.ist).length;
      }
    }
  });

  /**
   * Load configuration
   */

  if(configuration === undefined) {
    throw new TypeError('Not enough arguments');
  }

  try {
    this.loadConfig(configuration);
  } catch(e) {
    this.status = C.STATUS_NOT_READY;
    this.error = C.CONFIGURATION_ERROR;
    throw e;
  }

  // Initialize registrator
  this._registrator = new Registrator(this);

  events.EventEmitter.call(this);
}

util.inherits(UA, events.EventEmitter);


//=================
//  High Level API
//=================

/**
 * Connect to the server if status = STATUS_INIT.
 * Resume UA after being closed.
 */
UA.prototype.start = function() {
  debug('start()');

  if (this.status === C.STATUS_INIT) {
    this.transport.connect();
  } else if(this.status === C.STATUS_USER_CLOSED) {
    debug('restarting UA');

    // disconnect
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
      this.transport.disconnect();
    }

    // reconnect
    this.status = C.STATUS_INIT;
    this.transport.connect();
  } else if (this.status === C.STATUS_READY) {
    debug('UA is in READY status, not restarted');
  } else {
    debug('ERROR: connection is down, Auto-Recovery system is trying to reconnect');
  }

  // Set dynamic configuration.
  this.dynConfiguration.register = this.configuration.register;
};

/**
 * Register.
 */
UA.prototype.register = function() {
  debug('register()');

  this.dynConfiguration.register = true;
  this._registrator.register();
};

/**
 * Unregister.
 */
UA.prototype.unregister = function(options) {
  debug('unregister()');

  this.dynConfiguration.register = false;
  this._registrator.unregister(options);
};

/**
 * Get the Registrator instance.
 */
UA.prototype.registrator = function() {
  return this._registrator;
};

/**
 * Registration state.
 */
UA.prototype.isRegistered = function() {
  if(this._registrator.registered) {
    return true;
  } else {
    return false;
  }
};

/**
 * Connection state.
 */
UA.prototype.isConnected = function() {
  return this.transport.isConnected();
};

/**
 * Make an outgoing call.
 *
 * -param {String} target
 * -param {Object} views
 * -param {Object} [options]
 *
 * -throws {TypeError}
 *
 */
UA.prototype.call = function(target, options) {
  debug('call()');

  var session;

  session = new RTCSession(this);
  session.connect(target, options);
  return session;
};

/**
 * Send a message.
 *
 * -param {String} target
 * -param {String} body
 * -param {Object} [options]
 *
 * -throws {TypeError}
 *
 */
UA.prototype.sendMessage = function(target, body, options) {
  debug('sendMessage()');

  var message;

  message = new Message(this);
  message.send(target, body, options);
  return message;
};

/**
 * Terminate ongoing sessions.
 */
UA.prototype.terminateSessions = function(options) {
  debug('terminateSessions()');

  for(var idx in this.sessions) {
    if (!this.sessions[idx].isEnded()) {
      this.sessions[idx].terminate(options);
    }
  }
};

/**
 * Gracefully close.
 *
 */
UA.prototype.stop = function() {
  debug('stop()');

  var session;
  var applicant;
  var num_sessions;
  var ua = this;

  // Remove dynamic settings.
  this.dynConfiguration = {};

  if(this.status === C.STATUS_USER_CLOSED) {
    debug('UA already closed');
    return;
  }

  // Close registrator
  this._registrator.close();

  // If there are session wait a bit so CANCEL/BYE can be sent and their responses received.
  num_sessions = Object.keys(this.sessions).length;

  // Run  _terminate_ on every Session
  for(session in this.sessions) {
    debug('closing session ' + session);
    try { this.sessions[session].terminate(); } catch(error) {}
  }

  // Run  _close_ on every applicant
  for(applicant in this.applicants) {
    try { this.applicants[applicant].close(); } catch(error) {}
  }

  this.status = C.STATUS_USER_CLOSED;

  if (this.nistTransactionsCount  === 0 &&
      this.nictTransactionsCount  === 0 &&
      this.ictTransactionsCount   === 0 &&
      this.istTransactionsCount   === 0 &&
      num_sessions === 0) {
    ua.transport.disconnect();
  }
  else {
    this.closeTimer = setTimeout(function() {
      ua.closeTimer = null;
      ua.transport.disconnect();
    }, 2000);
  }
};

/**
 * Normalice a string into a valid SIP request URI
 * -param {String} target
 * -returns {JsSIP.URI|undefined}
 */
UA.prototype.normalizeTarget = function(target) {
  return Utils.normalizeTarget(target, this.configuration.hostport_params);
};

/**
 * Allow retrieving configuration and autogenerated fields in runtime.
 */
UA.prototype.get = function(parameter) {
  switch(parameter) {
    case 'realm':
      return this.configuration.realm;

    case 'ha1':
      return this.configuration.ha1;

    default:
      debugerror('get() | cannot get "%s" parameter in runtime', parameter);
      return undefined;
  }

  return true;
};

/**
 * Allow configuration changes in runtime.
 * Returns true if the parameter could be set.
 */
UA.prototype.set = function(parameter, value) {
  switch(parameter) {
    case 'password': {
      this.configuration.password = String(value);
      break;
    }

    case 'realm': {
      this.configuration.realm = String(value);
      break;
    }

    case 'ha1': {
      this.configuration.ha1 = String(value);
      // Delete the plain SIP password.
      this.configuration.password = null;
      break;
    }

    case 'display_name': {
      if (Grammar.parse('"' + value + '"', 'display_name') === -1) {
        debugerror('set() | wrong "display_name"');
        return false;
      }
      this.configuration.display_name = value;
      break;
    }

    default:
      debugerror('set() | cannot set "%s" parameter in runtime', parameter);
      return false;
  }

  return true;
};


//===============================
//  Private (For internal use)
//===============================

// UA.prototype.saveCredentials = function(credentials) {
//   this.cache.credentials[credentials.realm] = this.cache.credentials[credentials.realm] || {};
//   this.cache.credentials[credentials.realm][credentials.uri] = credentials;
// };

// UA.prototype.getCredentials = function(request) {
//   var realm, credentials;

//   realm = request.ruri.host;

//   if (this.cache.credentials[realm] && this.cache.credentials[realm][request.ruri]) {
//     credentials = this.cache.credentials[realm][request.ruri];
//     credentials.method = request.method;
//   }

//   return credentials;
// };


//==========================
// Event Handlers
//==========================

/**
 * new Transaction
 */
UA.prototype.newTransaction = function(transaction) {
  this.transactions[transaction.type][transaction.id] = transaction;
    this.emit('newTransaction', {
    transaction: transaction
  });
};


/**
 * Transaction destroyed.
 */
UA.prototype.destroyTransaction = function(transaction) {
  delete this.transactions[transaction.type][transaction.id];
    this.emit('transactionDestroyed', {
    transaction: transaction
  });
};


/**
 *  new Message
 */
UA.prototype.newMessage = function(data) {
  this.emit('newMessage', data);
};

/**
 * new RTCSession
 */
UA.prototype.newRTCSession = function(data) {
  this.emit('newRTCSession', data);
};

/**
 * Registered
 */
UA.prototype.registered = function(data) {
  this.emit('registered', data);
};


/**
 * Unregistered
 */
UA.prototype.unregistered = function(data) {
  this.emit('unregistered', data);
};


/**
 * Registration Failed
 */
UA.prototype.registrationFailed = function(data) {
  this.emit('registrationFailed', data);
};


//=========================
// receiveRequest
//=========================

/**
 * Request reception
 */
UA.prototype.receiveRequest = function(request) {
  var dialog, session, message, replaces,
  method = request.method;

  // Check that request URI points to us
  if(request.ruri.user !== this.configuration.uri.user && request.ruri.user !== this.contact.uri.user) {
    debug('Request-URI does not point to us');
    if (request.method !== JsSIP_C.ACK) {
      request.reply_sl(404);
    }
    return;
    }

    // Check request URI scheme
    if(request.ruri.scheme === JsSIP_C.SIPS) {
    request.reply_sl(416);
    return;
  }

  // Check transaction
  if(Transactions.checkTransaction(this, request)) {
    return;
  }

  // Create the server transaction
  if(method === JsSIP_C.INVITE) {
    new Transactions.InviteServerTransaction(request, this);
  } else if(method !== JsSIP_C.ACK && method !== JsSIP_C.CANCEL) {
    new Transactions.NonInviteServerTransaction(request, this);
  }

  /* RFC3261 12.2.2
   * Requests that do not change in any way the state of a dialog may be
   * received within a dialog (for example, an OPTIONS request).
   * They are processed as if they had been received outside the dialog.
   */
  if(method === JsSIP_C.OPTIONS) {
    request.reply(200);
  } else if (method === JsSIP_C.MESSAGE) {
    if (this.listeners('newMessage').length === 0) {
      request.reply(405);
      return;
    }
    message = new Message(this);
    message.init_incoming(request);
  } else if (method === JsSIP_C.INVITE) {
    // Initial INVITE
    if(!request.to_tag && this.listeners('newRTCSession').length === 0) {
      request.reply(405);
      return;
    }
  }

  // Initial Request
  if(!request.to_tag) {
    switch(method) {
      case JsSIP_C.INVITE:
        if (window.RTCPeerConnection) { // TODO
          if (request.hasHeader('replaces')) {
            replaces = request.replaces;
            dialog = this.findDialog(replaces.call_id, replaces.from_tag, replaces.to_tag);
            if (dialog) {
              session = dialog.owner;
              if (!session.isEnded()) {
                session.receiveRequest(request);
              } else {
                request.reply(603);
              }
            } else {
              request.reply(481);
            }
          } else {
            session = new RTCSession(this);
            session.init_incoming(request);
          }
        } else {
          debugerror('INVITE received but WebRTC is not supported');
          request.reply(488);
        }
        break;
      case JsSIP_C.BYE:
        // Out of dialog BYE received
        request.reply(481);
        break;
        case JsSIP_C.CANCEL:
        session = this.findSession(request);
        if (session) {
          session.receiveRequest(request);
        } else {
          debug('received CANCEL request for a non existent session');
        }
        break;
      case JsSIP_C.ACK:
        /* Absorb it.
         * ACK request without a corresponding Invite Transaction
         * and without To tag.
         */
        break;
        default:
        request.reply(405);
        break;
    }
  }
  // In-dialog request
  else {
    dialog = this.findDialog(request.call_id, request.from_tag, request.to_tag);

    if(dialog) {
      dialog.receiveRequest(request);
    } else if (method === JsSIP_C.NOTIFY) {
      session = this.findSession(request);
      if(session) {
        session.receiveRequest(request);
      } else {
        debug('received NOTIFY request for a non existent subscription');
        request.reply(481, 'Subscription does not exist');
      }
    }
    /* RFC3261 12.2.2
     * Request with to tag, but no matching dialog found.
     * Exception: ACK for an Invite request for which a dialog has not
     * been created.
     */
    else {
      if(method !== JsSIP_C.ACK) {
        request.reply(481);
      }
    }
  }
};

//=================
// Utils
//=================

/**
 * Get the session to which the request belongs to, if any.
 */
UA.prototype.findSession = function(request) {
  var
  sessionIDa = request.call_id + request.from_tag,
  sessionA = this.sessions[sessionIDa],
  sessionIDb = request.call_id + request.to_tag,
  sessionB = this.sessions[sessionIDb];

  if(sessionA) {
    return sessionA;
  } else if(sessionB) {
    return sessionB;
  } else {
    return null;
  }
};

/**
 * Get the dialog to which the request belongs to, if any.
 */
UA.prototype.findDialog = function(call_id, from_tag, to_tag) {
  var
  id = call_id + from_tag + to_tag,
  dialog = this.dialogs[id];

  if(dialog) {
    return dialog;
  } else {
    id = call_id + to_tag + from_tag;
    dialog = this.dialogs[id];
    if(dialog) {
      return dialog;
    } else {
      return null;
    }
  }
};

UA.prototype.loadConfig = function(configuration) {
  // Settings and default values
  var parameter, value, checked_value, hostport_params, registrar_server,
  settings = {
    /* Host address
    * Value to be set in Via sent_by and host part of Contact FQDN
    */
    via_host: Utils.createRandomToken(12) + '.invalid',

    // SIP Contact URI
    contact_uri: null,

    // SIP authentication password
    password: null,

    // SIP authentication realm
    realm: null,

    // SIP authentication HA1 hash
    ha1: null,

    // Registration parameters
    register_expires: 600,
    register: true,
    registrar_server: null,

    use_preloaded_route: false,

    // Session parameters
    no_answer_timeout: 60,
    session_timers: true,
  };

  // Pre-Configuration

  // Check Mandatory parameters
  for(parameter in UA.configuration_check.mandatory) {
    if(!configuration.hasOwnProperty(parameter)) {
      throw new Exceptions.ConfigurationError(parameter);
    } else {
      value = configuration[parameter];
      checked_value = UA.configuration_check.mandatory[parameter].call(this, value);
      if (checked_value !== undefined) {
        settings[parameter] = checked_value;
      } else {
        throw new Exceptions.ConfigurationError(parameter, value);
      }
    }
  }

  // Check Optional parameters
  for(parameter in UA.configuration_check.optional) {
    if(configuration.hasOwnProperty(parameter)) {
      value = configuration[parameter];

      /* If the parameter value is null, empty string, undefined, empty array
       * or it's a number with NaN value, then apply its default value.
       */
      if (Utils.isEmpty(value)) {
        continue;
      }

      checked_value = UA.configuration_check.optional[parameter].call(this, value, configuration);
      if (checked_value !== undefined) {
        settings[parameter] = checked_value;
      } else {
        throw new Exceptions.ConfigurationError(parameter, value);
      }
    }
  }

  // Post Configuration Process

  // Allow passing 0 number as display_name.
  if (settings.display_name === 0) {
    settings.display_name = '0';
  }

  // Instance-id for GRUU.
  if (!settings.instance_id) {
    settings.instance_id = Utils.newUUID();
  }

  // plivosip_id instance parameter. Static random tag of length 5.
  settings.plivosip_id = Utils.createRandomToken(5);

  // String containing settings.uri without scheme and user.
  hostport_params = settings.uri.clone();
  hostport_params.user = null;
  settings.hostport_params = hostport_params.toString().replace(/^sip:/i, '');

  // Transport
  var sockets = [];

  if (settings.sockets && Array.isArray(settings.sockets)) {
    sockets = sockets.concat(settings.sockets);
  }

  if (sockets.length === 0) {
    throw new Exceptions.ConfigurationError('sockets');
  }

  try {
    this.transport = new Transport(sockets, { /* recovery options */
      max_interval: settings.connection_recovery_max_interval,
      min_interval: settings.connection_recovery_min_interval
    });

    // Transport event callbacks
    this.transport.onconnecting = onTransportConnecting.bind(this);
    this.transport.onconnect    = onTransportConnect.bind(this);
    this.transport.ondisconnect = onTransportDisconnect.bind(this);
    this.transport.ondata       = onTransportData.bind(this);

    // transport options not needed here anymore
    delete settings.connection_recovery_max_interval;
    delete settings.connection_recovery_min_interval;
    delete settings.sockets;
  } catch (e) {
    debugerror(e);
    throw new Exceptions.ConfigurationError('sockets', sockets);
  }

  // Check whether authorization_user is explicitly defined.
  // Take 'settings.uri.user' value if not.
  if (!settings.authorization_user) {
    settings.authorization_user = settings.uri.user;
  }

  // If no 'registrar_server' is set use the 'uri' value without user portion and
  // without URI params/headers.
  if (!settings.registrar_server) {
    registrar_server = settings.uri.clone();
    registrar_server.user = null;
    registrar_server.clearParams();
    registrar_server.clearHeaders();
    settings.registrar_server = registrar_server;
  }

  // User no_answer_timeout.
  settings.no_answer_timeout = settings.no_answer_timeout * 1000;

  // Via Host
  if (settings.contact_uri) {
    settings.via_host = settings.contact_uri.host;
  }

  // Contact URI
  else {
    settings.contact_uri = new URI('sip', Utils.createRandomToken(8), settings.via_host, null, {transport: 'ws'});
  }

  this.contact = {
    pub_gruu: null,
    temp_gruu: null,
    uri: settings.contact_uri,
    toString: function(options) {
      options = options || {};

      var
      anonymous = options.anonymous || null,
      outbound = options.outbound || null,
      contact = '<';

      if (anonymous) {
        contact += this.temp_gruu || 'sip:anonymous@anonymous.invalid;transport=ws';
      } else {
        contact += this.pub_gruu || this.uri.toString();
      }

      if (outbound && (anonymous ? !this.temp_gruu : !this.pub_gruu)) {
        contact += ';ob';
      }

      contact += '>';

      return contact;
    }
  };

  // Fill the value of the configuration_skeleton
  for(parameter in settings) {
    UA.configuration_skeleton[parameter].value = settings[parameter];
  }

  Object.defineProperties(this.configuration, UA.configuration_skeleton);

  // Clean UA.configuration_skeleton
  for(parameter in settings) {
    UA.configuration_skeleton[parameter].value = '';
  }

  
  for(parameter in settings) {
    switch(parameter) {
      case 'uri':
      case 'registrar_server':
        debug('- ' + parameter + ': ' + settings[parameter]);
        break;
      case 'password':
      case 'ha1':
        debug('- ' + parameter + ': ' + 'NOT SHOWN');
        break;
      default:
        debug('- ' + parameter + ': ' + JSON.stringify(settings[parameter]));
    }
  }

  return;
};

/**
 * Configuration Object skeleton.
 */
UA.configuration_skeleton = (function() {
  var
    idx, parameter, writable,
    skeleton = {},
    parameters = [
      // Internal parameters
      'plivosip_id',
      'hostport_params',

      // Mandatory user configurable parameters
      'uri',

      // Optional user configurable parameters
      'authorization_user',
      'contact_uri',
      'display_name',
      'instance_id',
      'no_answer_timeout', // 30 seconds
      'session_timers', // true
      'password',
      'realm',
      'ha1',
      'register_expires', // 600 seconds
      'registrar_server',
      'sockets',
      'use_preloaded_route',

      // Post-configuration generated parameters
      'via_core_value',
      'via_host'
    ];

  var writable_parameters = [
    'password', 'realm', 'ha1', 'display_name'
  ];

  for(idx in parameters) {
    parameter = parameters[idx];

    if (writable_parameters.indexOf(parameter) !== -1) {
      writable = true;
    } else {
      writable = false;
    }

    skeleton[parameter] = {
      value: '',
      writable: writable,
      configurable: false
    };
  }

  skeleton.register = {
    value: '',
    writable: true,
    configurable: false
  };

  return skeleton;
}());

/**
 * Configuration checker.
 */
UA.configuration_check = {
  mandatory: {

    uri: function(uri) {
      var parsed;

      if (!/^sip:/i.test(uri)) {
        uri = JsSIP_C.SIP + ':' + uri;
      }
      parsed = URI.parse(uri);

      if(!parsed) {
        return;
      } else if(!parsed.user) {
        return;
      } else {
        return parsed;
      }
    }
  },

  optional: {

    authorization_user: function(authorization_user) {
      if(Grammar.parse('"'+ authorization_user +'"', 'quoted_string') === -1) {
        return;
      } else {
        return authorization_user;
      }
    },

    connection_recovery_max_interval: function(connection_recovery_max_interval) {
      var value;
      if(Utils.isDecimal(connection_recovery_max_interval)) {
        value = Number(connection_recovery_max_interval);
        if(value > 0) {
          return value;
        }
      }
    },

    connection_recovery_min_interval: function(connection_recovery_min_interval) {
      var value;
      if(Utils.isDecimal(connection_recovery_min_interval)) {
        value = Number(connection_recovery_min_interval);
        if(value > 0) {
          return value;
        }
      }
    },

    contact_uri: function(contact_uri) {
      if (typeof contact_uri === 'string') {
        var uri = Grammar.parse(contact_uri,'SIP_URI');
        if (uri !== -1) {
          return uri;
        }
      }
    },

    display_name: function(display_name) {
      if (Grammar.parse('"' + display_name + '"', 'display_name') === -1) {
        return;
      } else {
        return display_name;
      }
    },

    instance_id: function(instance_id) {
      if ((/^uuid:/i.test(instance_id))) {
        instance_id = instance_id.substr(5);
      }

      if(Grammar.parse(instance_id, 'uuid') === -1) {
        return;
      } else {
        return instance_id;
      }
    },

    no_answer_timeout: function(no_answer_timeout) {
      var value;
      if (Utils.isDecimal(no_answer_timeout)) {
        value = Number(no_answer_timeout);
        if (value > 0) {
          return value;
        }
      }
    },

    session_timers: function(session_timers) {
      if (typeof session_timers === 'boolean') {
        return session_timers;
      }
    },

    password: function(password) {
      return String(password);
    },

    realm: function(realm) {
      return String(realm);
    },

    ha1: function(ha1) {
      return String(ha1);
    },

    register: function(register) {
      if (typeof register === 'boolean') {
        return register;
      }
    },

    register_expires: function(register_expires) {
      var value;
      if (Utils.isDecimal(register_expires)) {
        value = Number(register_expires);
        if (value > 0) {
          return value;
        }
      }
    },

    registrar_server: function(registrar_server) {
      var parsed;

      if (!/^sip:/i.test(registrar_server)) {
        registrar_server = JsSIP_C.SIP + ':' + registrar_server;
      }
      parsed = URI.parse(registrar_server);

      if(!parsed) {
        return;
      } else if(parsed.user) {
        return;
      } else {
        return parsed;
      }
    },

    sockets: function(sockets) {
      var idx, length;

      /* Allow defining sockets parameter as:
       *  Socket: socket
       *  Array of Socket: [socket1, socket2]
       *  Array of Objects: [{socket: socket1, weight:1}, {socket: Socket2, weight:0}]
       *  Array of Objects and Socket: [{socket: socket1}, socket2]
       */
      if (Socket.isSocket(sockets)) {
        sockets = [{socket: sockets}];
      } else if (Array.isArray(sockets) && sockets.length) {
        length = sockets.length;
        for (idx = 0; idx < length; idx++) {
          if (Socket.isSocket(sockets[idx])) {
            sockets[idx] = {socket: sockets[idx]};
          }
        }
      } else {
        return;
      }

      return sockets;
    },

    use_preloaded_route: function(use_preloaded_route) {
      if (typeof use_preloaded_route === 'boolean') {
        return use_preloaded_route;
      }
    }
  }
};

/**
 * Transport event handlers
 */

// Transport connecting event
function onTransportConnecting(data) {
  this.emit('connecting', data);
}

// Transport connected event.
function onTransportConnect(data) {
  if(this.status === C.STATUS_USER_CLOSED) {
    return;
  }

  this.status = C.STATUS_READY;
  this.error = null;

  this.emit('connected', data);

  if(this.dynConfiguration.register) {
    this._registrator.register();
  }
}

// Transport disconnected event.
function onTransportDisconnect(data) {
  // Run _onTransportError_ callback on every client transaction using _transport_
  var type, idx, length,
  client_transactions = ['nict', 'ict', 'nist', 'ist'];

  length = client_transactions.length;
  for (type = 0; type < length; type++) {
    for(idx in this.transactions[client_transactions[type]]) {
      this.transactions[client_transactions[type]][idx].onTransportError();
    }
  }

  this.emit('disconnected', data);

  // Call registrator _onTransportClosed_
  this._registrator.onTransportClosed();

  if (this.status !== C.STATUS_USER_CLOSED) {
    this.status = C.STATUS_NOT_READY;
    this.error = C.NETWORK_ERROR;
  }
}

// Transport data event
function onTransportData(data) {
 var transaction,
  transport = data.transport,
  message = data.message;

 message = Parser.parseMessage(message, this);

 if (! message) {
   return;
 }

 if (this.status === UA.C.STATUS_USER_CLOSED &&
     message instanceof SIPMessage.IncomingRequest) {
   return;
 }

 // Do some sanity check
 if(! sanityCheck(message, this, transport)) {
   return;
 }

 if(message instanceof SIPMessage.IncomingRequest) {
   message.transport = transport;
   this.receiveRequest(message);
 } else if(message instanceof SIPMessage.IncomingResponse) {
   /* Unike stated in 18.1.2, if a response does not match
   * any transaction, it is discarded here and no passed to the core
   * in order to be discarded there.
   */
   switch(message.method) {
     case JsSIP_C.INVITE:
       transaction = this.transactions.ict[message.via_branch];
       if(transaction) {
         transaction.receiveResponse(message);
       }
       break;
     case JsSIP_C.ACK:
       // Just in case ;-)
       break;
     default:
       transaction = this.transactions.nict[message.via_branch];
       if(transaction) {
         transaction.receiveResponse(message);
       }
       break;
   }
 }
}

},{"./Constants":35,"./Exceptions":39,"./Grammar":40,"./Message":42,"./Parser":44,"./RTCSession":45,"./Registrator":50,"./SIPMessage":52,"./Socket":53,"./Transactions":55,"./Transport":56,"./URI":58,"./Utils":59,"./sanityCheck":61,"debug":11,"events":13,"util":23}],58:[function(require,module,exports){
module.exports = URI;


/**
 * Dependencies.
 */
var JsSIP_C = require('./Constants');
var Utils = require('./Utils');
var Grammar = require('./Grammar');


/**
 * -param {String} [scheme]
 * -param {String} [user]
 * -param {String} host
 * -param {String} [port]
 * -param {Object} [parameters]
 * -param {Object} [headers]
 *
 */
function URI(scheme, user, host, port, parameters, headers) {
  var param, header;

  // Checks
  if(!host) {
    throw new TypeError('missing or invalid "host" parameter');
  }

  // Initialize parameters
  scheme = scheme || JsSIP_C.SIP;
  this.parameters = {};
  this.headers = {};

  for (param in parameters) {
    this.setParam(param, parameters[param]);
  }

  for (header in headers) {
    this.setHeader(header, headers[header]);
  }

  Object.defineProperties(this, {
    scheme: {
      get: function(){ return scheme; },
      set: function(value){
        scheme = value.toLowerCase();
      }
    },

    user: {
      get: function(){ return user; },
      set: function(value){
        user = value;
      }
    },

    host: {
      get: function(){ return host; },
      set: function(value){
        host = value.toLowerCase();
      }
    },

    port: {
      get: function(){ return port; },
      set: function(value){
        port = value === 0 ? value : (parseInt(value,10) || null);
      }
    }
  });
}


URI.prototype = {
  setParam: function(key, value) {
    if(key) {
      this.parameters[key.toLowerCase()] = (typeof value === 'undefined' || value === null) ? null : value.toString();
    }
  },

  getParam: function(key) {
    if(key) {
      return this.parameters[key.toLowerCase()];
    }
  },

  hasParam: function(key) {
    if(key) {
      return (this.parameters.hasOwnProperty(key.toLowerCase()) && true) || false;
    }
  },

  deleteParam: function(parameter) {
    var value;
    parameter = parameter.toLowerCase();
    if (this.parameters.hasOwnProperty(parameter)) {
      value = this.parameters[parameter];
      delete this.parameters[parameter];
      return value;
    }
  },

  clearParams: function() {
    this.parameters = {};
  },

  setHeader: function(name, value) {
    this.headers[Utils.headerize(name)] = (Array.isArray(value)) ? value : [value];
  },

  getHeader: function(name) {
    if(name) {
      return this.headers[Utils.headerize(name)];
    }
  },

  hasHeader: function(name) {
    if(name) {
      return (this.headers.hasOwnProperty(Utils.headerize(name)) && true) || false;
    }
  },

  deleteHeader: function(header) {
    var value;
    header = Utils.headerize(header);
    if(this.headers.hasOwnProperty(header)) {
      value = this.headers[header];
      delete this.headers[header];
      return value;
    }
  },

  clearHeaders: function() {
    this.headers = {};
  },

  clone: function() {
    return new URI(
      this.scheme,
      this.user,
      this.host,
      this.port,
      JSON.parse(JSON.stringify(this.parameters)),
      JSON.parse(JSON.stringify(this.headers)));
  },

  toString: function(){
    var header, parameter, idx, uri,
      headers = [];

    uri  = this.scheme + ':';
    if (this.user) {
      uri += Utils.escapeUser(this.user) + '@';
    }
    uri += this.host;
    if (this.port || this.port === 0) {
      uri += ':' + this.port;
    }

    for (parameter in this.parameters) {
      uri += ';' + parameter;

      if (this.parameters[parameter] !== null) {
        uri += '='+ this.parameters[parameter];
      }
    }

    for(header in this.headers) {
      for(idx = 0; idx < this.headers[header].length; idx++) {
        headers.push(header + '=' + this.headers[header][idx]);
      }
    }

    if (headers.length > 0) {
      uri += '?' + headers.join('&');
    }

    return uri;
  },

  toAor: function(show_port){
      var aor;

      aor  = this.scheme + ':';
      if (this.user) {
        aor += Utils.escapeUser(this.user) + '@';
      }
      aor += this.host;
      if (show_port && (this.port || this.port === 0)) {
        aor += ':' + this.port;
      }

      return aor;
  }
};


/**
  * Parse the given string and returns a JsSIP.URI instance or undefined if
  * it is an invalid URI.
  */
URI.parse = function(uri) {
  uri = Grammar.parse(uri,'SIP_URI');

  if (uri !== -1) {
    return uri;
  } else {
    return undefined;
  }
};

},{"./Constants":35,"./Grammar":40,"./Utils":59}],59:[function(require,module,exports){
var Utils = {};

module.exports = Utils;


/**
 * Dependencies.
 */
var JsSIP_C = require('./Constants');
var URI = require('./URI');
var Grammar = require('./Grammar');


Utils.str_utf8_length = function(string) {
  return unescape(encodeURIComponent(string)).length;
};

Utils.isFunction = function(fn) {
  if (fn !== undefined) {
    return (Object.prototype.toString.call(fn) === '[object Function]')? true : false;
  } else {
    return false;
  }
};

Utils.isString = function(str) {
  if (str !== undefined) {
    return (Object.prototype.toString.call(str) === '[object String]')? true : false;
  } else {
    return false;
  }
};

Utils.isDecimal = function(num) {
  return !isNaN(num) && (parseFloat(num) === parseInt(num,10));
};

Utils.isEmpty = function(value) {
  if (value === null || value === '' || value === undefined || (Array.isArray(value) && value.length === 0) || (typeof(value) === 'number' && isNaN(value))) {
    return true;
  }
};

Utils.hasMethods = function(obj /*, method list as strings */){
  var i = 1, methodName;
  while((methodName = arguments[i++])){
    if(this.isFunction(obj[methodName])) {
      return false;
    }
  }
  return true;
};

Utils.createRandomToken = function(size, base) {
  var i, r,
    token = '';

  base = base || 32;

  for( i=0; i < size; i++ ) {
    r = Math.random() * base|0;
    token += r.toString(base);
  }
  return token;
};

Utils.newTag = function() {
  return Utils.createRandomToken(10);
};

// http://stackoverflow.com/users/109538/broofa
Utils.newUUID = function() {
  var UUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });

  return UUID;
};

Utils.hostType = function(host) {
  if (!host) {
    return;
  } else {
    host = Grammar.parse(host,'host');
    if (host !== -1) {
      return host.host_type;
    }
  }
};

/**
* Normalize SIP URI.
* NOTE: It does not allow a SIP URI without username.
* Accepts 'sip', 'sips' and 'tel' URIs and convert them into 'sip'.
* Detects the domain part (if given) and properly hex-escapes the user portion.
* If the user portion has only 'tel' number symbols the user portion is clean of 'tel' visual separators.
*/
Utils.normalizeTarget = function(target, domain) {
  var uri, target_array, target_user, target_domain;

  // If no target is given then raise an error.
  if (!target) {
    return;
  // If a URI instance is given then return it.
  } else if (target instanceof URI) {
    return target;

  // If a string is given split it by '@':
  // - Last fragment is the desired domain.
  // - Otherwise append the given domain argument.
  } else if (typeof target === 'string') {
    target_array = target.split('@');

    switch(target_array.length) {
      case 1:
        if (!domain) {
          return;
        }
        target_user = target;
        target_domain = domain;
        break;
      case 2:
        target_user = target_array[0];
        target_domain = target_array[1];
        break;
      default:
        target_user = target_array.slice(0, target_array.length-1).join('@');
        target_domain = target_array[target_array.length-1];
    }

    // Remove the URI scheme (if present).
    target_user = target_user.replace(/^(sips?|tel):/i, '');

    // Remove 'tel' visual separators if the user portion just contains 'tel' number symbols.
    if (/^[\-\.\(\)]*\+?[0-9\-\.\(\)]+$/.test(target_user)) {
      target_user = target_user.replace(/[\-\.\(\)]/g, '');
    }

    // Build the complete SIP URI.
    target = JsSIP_C.SIP + ':' + Utils.escapeUser(target_user) + '@' + target_domain;

    // Finally parse the resulting URI.
    if ((uri = URI.parse(target))) {
      return uri;
    } else {
      return;
    }
  } else {
    return;
  }
};

/**
* Hex-escape a SIP URI user.
*/
Utils.escapeUser = function(user) {
  // Don't hex-escape ':' (%3A), '+' (%2B), '?' (%3F"), '/' (%2F).
  return encodeURIComponent(decodeURIComponent(user)).replace(/%3A/ig, ':').replace(/%2B/ig, '+').replace(/%3F/ig, '?').replace(/%2F/ig, '/');
};

Utils.headerize = function(string) {
  var exceptions = {
    'Call-Id': 'Call-ID',
    'Cseq': 'CSeq',
    'Www-Authenticate': 'WWW-Authenticate'
    },
    name = string.toLowerCase().replace(/_/g,'-').split('-'),
    hname = '',
    parts = name.length, part;

  for (part = 0; part < parts; part++) {
    if (part !== 0) {
      hname +='-';
    }
    hname += name[part].charAt(0).toUpperCase()+name[part].substring(1);
  }
  if (exceptions[hname]) {
    hname = exceptions[hname];
  }
  return hname;
};

Utils.sipErrorCause = function(status_code) {
  var cause;

  for (cause in JsSIP_C.SIP_ERROR_CAUSES) {
    if (JsSIP_C.SIP_ERROR_CAUSES[cause].indexOf(status_code) !== -1) {
      return JsSIP_C.causes[cause];
    }
  }

  return JsSIP_C.causes.SIP_FAILURE_CODE;
};

/**
* Generate a random Test-Net IP (http://tools.ietf.org/html/rfc5735)
*/
Utils.getRandomTestNetIP = function() {
  function getOctet(from,to) {
    return Math.floor(Math.random()*(to-from+1)+from);
  }
  return '192.0.2.' + getOctet(1, 254);
};

// MD5 (Message-Digest Algorithm) http://www.webtoolkit.info
Utils.calculateMD5 = function(string) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
  }

  function addUnsigned(lX,lY) {
    var lX4,lY4,lX8,lY8,lResult;
    lX8 = (lX & 0x80000000);
    lY8 = (lY & 0x80000000);
    lX4 = (lX & 0x40000000);
    lY4 = (lY & 0x40000000);
    lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
    if (lX4 & lY4) {
      return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
    }
    if (lX4 | lY4) {
      if (lResult & 0x40000000) {
        return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
      } else {
        return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      }
    } else {
      return (lResult ^ lX8 ^ lY8);
    }
  }

  function doF(x,y,z) {
    return (x & y) | ((~x) & z);
  }

  function doG(x,y,z) {
    return (x & z) | (y & (~z));
  }

  function doH(x,y,z) {
    return (x ^ y ^ z);
  }

  function doI(x,y,z) {
    return (y ^ (x | (~z)));
  }

  function doFF(a,b,c,d,x,s,ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(doF(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function doGG(a,b,c,d,x,s,ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(doG(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function doHH(a,b,c,d,x,s,ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(doH(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function doII(a,b,c,d,x,s,ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(doI(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(string) {
    var lWordCount;
    var lMessageLength = string.length;
    var lNumberOfWords_temp1=lMessageLength + 8;
    var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
    var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
    var lWordArray = new Array(lNumberOfWords-1);
    var lBytePosition = 0;
    var lByteCount = 0;
    while ( lByteCount < lMessageLength ) {
      lWordCount = (lByteCount-(lByteCount % 4))/4;
      lBytePosition = (lByteCount % 4)*8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount-(lByteCount % 4))/4;
    lBytePosition = (lByteCount % 4)*8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
    lWordArray[lNumberOfWords-2] = lMessageLength<<3;
    lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
    return lWordArray;
  }

  function wordToHex(lValue) {
    var wordToHexValue='',wordToHexValue_temp='',lByte,lCount;
    for (lCount = 0;lCount<=3;lCount++) {
      lByte = (lValue>>>(lCount*8)) & 255;
      wordToHexValue_temp = '0' + lByte.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length-2,2);
    }
    return wordToHexValue;
  }

  function utf8Encode(string) {
    string = string.replace(/\r\n/g, '\n');
    var utftext = '';

    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n);

      if (c < 128) {
        utftext += String.fromCharCode(c);
      }
      else if((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      }
      else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }
    return utftext;
  }

  var x=[];
  var k,AA,BB,CC,DD,a,b,c,d;
  var S11=7, S12=12, S13=17, S14=22;
  var S21=5, S22=9 , S23=14, S24=20;
  var S31=4, S32=11, S33=16, S34=23;
  var S41=6, S42=10, S43=15, S44=21;

  string = utf8Encode(string);

  x = convertToWordArray(string);

  a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

  for (k=0;k<x.length;k+=16) {
    AA=a; BB=b; CC=c; DD=d;
    a=doFF(a,b,c,d,x[k+0], S11,0xD76AA478);
    d=doFF(d,a,b,c,x[k+1], S12,0xE8C7B756);
    c=doFF(c,d,a,b,x[k+2], S13,0x242070DB);
    b=doFF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
    a=doFF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
    d=doFF(d,a,b,c,x[k+5], S12,0x4787C62A);
    c=doFF(c,d,a,b,x[k+6], S13,0xA8304613);
    b=doFF(b,c,d,a,x[k+7], S14,0xFD469501);
    a=doFF(a,b,c,d,x[k+8], S11,0x698098D8);
    d=doFF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
    c=doFF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
    b=doFF(b,c,d,a,x[k+11],S14,0x895CD7BE);
    a=doFF(a,b,c,d,x[k+12],S11,0x6B901122);
    d=doFF(d,a,b,c,x[k+13],S12,0xFD987193);
    c=doFF(c,d,a,b,x[k+14],S13,0xA679438E);
    b=doFF(b,c,d,a,x[k+15],S14,0x49B40821);
    a=doGG(a,b,c,d,x[k+1], S21,0xF61E2562);
    d=doGG(d,a,b,c,x[k+6], S22,0xC040B340);
    c=doGG(c,d,a,b,x[k+11],S23,0x265E5A51);
    b=doGG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
    a=doGG(a,b,c,d,x[k+5], S21,0xD62F105D);
    d=doGG(d,a,b,c,x[k+10],S22,0x2441453);
    c=doGG(c,d,a,b,x[k+15],S23,0xD8A1E681);
    b=doGG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
    a=doGG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
    d=doGG(d,a,b,c,x[k+14],S22,0xC33707D6);
    c=doGG(c,d,a,b,x[k+3], S23,0xF4D50D87);
    b=doGG(b,c,d,a,x[k+8], S24,0x455A14ED);
    a=doGG(a,b,c,d,x[k+13],S21,0xA9E3E905);
    d=doGG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
    c=doGG(c,d,a,b,x[k+7], S23,0x676F02D9);
    b=doGG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
    a=doHH(a,b,c,d,x[k+5], S31,0xFFFA3942);
    d=doHH(d,a,b,c,x[k+8], S32,0x8771F681);
    c=doHH(c,d,a,b,x[k+11],S33,0x6D9D6122);
    b=doHH(b,c,d,a,x[k+14],S34,0xFDE5380C);
    a=doHH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
    d=doHH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
    c=doHH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
    b=doHH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
    a=doHH(a,b,c,d,x[k+13],S31,0x289B7EC6);
    d=doHH(d,a,b,c,x[k+0], S32,0xEAA127FA);
    c=doHH(c,d,a,b,x[k+3], S33,0xD4EF3085);
    b=doHH(b,c,d,a,x[k+6], S34,0x4881D05);
    a=doHH(a,b,c,d,x[k+9], S31,0xD9D4D039);
    d=doHH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
    c=doHH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
    b=doHH(b,c,d,a,x[k+2], S34,0xC4AC5665);
    a=doII(a,b,c,d,x[k+0], S41,0xF4292244);
    d=doII(d,a,b,c,x[k+7], S42,0x432AFF97);
    c=doII(c,d,a,b,x[k+14],S43,0xAB9423A7);
    b=doII(b,c,d,a,x[k+5], S44,0xFC93A039);
    a=doII(a,b,c,d,x[k+12],S41,0x655B59C3);
    d=doII(d,a,b,c,x[k+3], S42,0x8F0CCC92);
    c=doII(c,d,a,b,x[k+10],S43,0xFFEFF47D);
    b=doII(b,c,d,a,x[k+1], S44,0x85845DD1);
    a=doII(a,b,c,d,x[k+8], S41,0x6FA87E4F);
    d=doII(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
    c=doII(c,d,a,b,x[k+6], S43,0xA3014314);
    b=doII(b,c,d,a,x[k+13],S44,0x4E0811A1);
    a=doII(a,b,c,d,x[k+4], S41,0xF7537E82);
    d=doII(d,a,b,c,x[k+11],S42,0xBD3AF235);
    c=doII(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
    b=doII(b,c,d,a,x[k+9], S44,0xEB86D391);
    a=addUnsigned(a,AA);
    b=addUnsigned(b,BB);
    c=addUnsigned(c,CC);
    d=addUnsigned(d,DD);
  }

  var temp = wordToHex(a)+wordToHex(b)+wordToHex(c)+wordToHex(d);

  return temp.toLowerCase();
};

Utils.closeMediaStream = function(stream) {
  if (!stream) {
    return;
  }

  // Latest spec states that MediaStream has no stop() method and instead must
  // call stop() on every MediaStreamTrack.
  try {
    var tracks, i, len;

    if (stream.getTracks) {
      tracks = stream.getTracks();
      for (i = 0, len = tracks.length; i < len; i += 1) {
        tracks[i].stop();
      }
    } else {
      tracks = stream.getAudioTracks();
      for (i = 0, len = tracks.length; i < len; i += 1) {
        tracks[i].stop();
      }
      tracks = stream.getVideoTracks();
      for (i = 0, len = tracks.length; i < len; i += 1) {
        tracks[i].stop();
      }
    }
  } catch (error) {
    // Deprecated by the spec, but still in use.
    // NOTE: In Temasys IE plugin stream.stop is a callable 'object'.
    if (typeof stream.stop === 'function' || typeof stream.stop === 'object') {
      stream.stop();
    }
  }
};

},{"./Constants":35,"./Grammar":40,"./URI":58}],60:[function(require,module,exports){
module.exports = WebSocketInterface;

/**
 * Dependencies.
 */
var Grammar = require('./Grammar');
var debug = require('debug')('PlivoSIP:WebSocketInterface');
var debugerror = require('debug')('PlivoSIP:ERROR:WebSocketInterface');
debugerror.log = console.warn.bind(console);

function WebSocketInterface(url) {
  debug('new() [url:"%s"]', url);

  var sip_uri = null;
  var via_transport = null;

  this.ws = null;

  // setting the 'scheme' alters the sip_uri too (used in SIP Route header field)
  Object.defineProperties(this, {
    via_transport: {
      get: function() { return via_transport; },
      set: function(transport) {
        via_transport = transport.toUpperCase();
      }
    },
    sip_uri:  { get: function() { return sip_uri; }},
    url:      { get: function() { return url; }}
  });

  var parsed_url = Grammar.parse(url, 'absoluteURI');

  if (parsed_url === -1) {
    debugerror('invalid WebSocket URI: ' + url);
    throw new TypeError('Invalid argument: ' + url);
  } else if(parsed_url.scheme !== 'wss' && parsed_url.scheme !== 'ws') {
    debugerror('invalid WebSocket URI scheme: ' + parsed_url.scheme);
    throw new TypeError('Invalid argument: ' + url);
  } else {
    sip_uri = 'sip:' + parsed_url.host +
      (parsed_url.port ? ':' + parsed_url.port : '') + ';transport=ws';
    this.via_transport = parsed_url.scheme;
  }
}

WebSocketInterface.prototype.connect = function () {
  debug('connect()');

  if (this.isConnected()) {
    debug('WebSocket ' + this.url + ' is already connected');
    return;
  } else if (this.isConnecting()) {
    debug('WebSocket ' + this.url + ' is connecting');
    return;
  }

  if (this.ws) {
    this.disconnect();
  }

  debug('connecting to WebSocket ' + this.url);

  try {
    this.ws = new WebSocket(this.url, 'sip');

    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen    = onOpen.bind(this);
    this.ws.onclose   = onClose.bind(this);
    this.ws.onmessage = onMessage.bind(this);
    this.ws.onerror   = onError.bind(this);
  } catch(e) {
    onError.call(this, e);
  }
};

WebSocketInterface.prototype.disconnect = function() {
  debug('disconnect()');

  if (this.ws) {
    // unbind websocket event callbacks
    this.ws.onopen    = function() {};
    this.ws.onclose   = function() {};
    this.ws.onmessage = function() {};
    this.ws.onerror   = function() {};

    this.ws.close();
    this.ws = null;
  }
};

WebSocketInterface.prototype.send = function(message) {
  debug('send()');

  if (this.isConnected()) {
    this.ws.send(message);
    return true;
  } else {
    debugerror('unable to send message, WebSocket is not open');
    return false;
  }
};

WebSocketInterface.prototype.isConnected = function() {
  return this.ws && this.ws.readyState === this.ws.OPEN;
};

WebSocketInterface.prototype.isConnecting = function() {
  return this.ws && this.ws.readyState === this.ws.CONNECTING;
};


/**
 * WebSocket Event Handlers
 */

function onOpen() {
  debug('WebSocket ' + this.url + ' connected');

  this.onconnect();
}

function onClose(e) {
  debug('WebSocket ' + this.url + ' closed');

  if (e.wasClean === false) {
    debug('WebSocket abrupt disconnection');
  }

  this.ondisconnect(e.wasClean, e.code, e.reason);
}

function onMessage(e) {
  debug('received WebSocket message');

  this.ondata(e.data);
}

function onError(e) {
  debugerror('WebSocket ' + this.url + ' error: '+ e);
}

},{"./Grammar":40,"debug":11}],61:[function(require,module,exports){
module.exports = sanityCheck;


/**
 * Dependencies.
 */
var debug = require('debug')('PlivoSIP:sanityCheck');
var JsSIP_C = require('./Constants');
var SIPMessage = require('./SIPMessage');
var Utils = require('./Utils');


var message, ua, transport,
  requests = [],
  responses = [],
  all = [];


requests.push(rfc3261_8_2_2_1);
requests.push(rfc3261_16_3_4);
requests.push(rfc3261_18_3_request);
requests.push(rfc3261_8_2_2_2);

responses.push(rfc3261_8_1_3_3);
responses.push(rfc3261_18_3_response);

all.push(minimumHeaders);


function sanityCheck(m, u, t) {
  var len, pass;

  message = m;
  ua = u;
  transport = t;

  len = all.length;
  while(len--) {
    pass = all[len](message);
    if(pass === false) {
      return false;
    }
  }

  if(message instanceof SIPMessage.IncomingRequest) {
    len = requests.length;
    while(len--) {
      pass = requests[len](message);
      if(pass === false) {
        return false;
      }
    }
  }

  else if(message instanceof SIPMessage.IncomingResponse) {
    len = responses.length;
    while(len--) {
      pass = responses[len](message);
      if(pass === false) {
        return false;
      }
    }
  }

  //Everything is OK
  return true;
}


/*
 * Sanity Check for incoming Messages
 *
 * Requests:
 *  - _rfc3261_8_2_2_1_ Receive a Request with a non supported URI scheme
 *  - _rfc3261_16_3_4_ Receive a Request already sent by us
 *   Does not look at via sent-by but at plivosip_id, which is inserted as
 *   a prefix in all initial requests generated by the ua
 *  - _rfc3261_18_3_request_ Body Content-Length
 *  - _rfc3261_8_2_2_2_ Merged Requests
 *
 * Responses:
 *  - _rfc3261_8_1_3_3_ Multiple Via headers
 *  - _rfc3261_18_3_response_ Body Content-Length
 *
 * All:
 *  - Minimum headers in a SIP message
 */

// Sanity Check functions for requests
function rfc3261_8_2_2_1() {
  if(message.s('to').uri.scheme !== 'sip') {
    reply(416);
    return false;
  }
}

function rfc3261_16_3_4() {
  if(!message.to_tag) {
    if(message.call_id.substr(0, 5) === ua.configuration.plivosip_id) {
      reply(482);
      return false;
    }
  }
}

function rfc3261_18_3_request() {
  var len = Utils.str_utf8_length(message.body),
  contentLength = message.getHeader('content-length');

  if(len < contentLength) {
    reply(400);
    return false;
  }
}

function rfc3261_8_2_2_2() {
  var tr, idx,
    fromTag = message.from_tag,
    call_id = message.call_id,
    cseq = message.cseq;

  // Accept any in-dialog request.
  if(message.to_tag) {
    return;
  }

  // INVITE request.
  if (message.method === JsSIP_C.INVITE) {
    // If the branch matches the key of any IST then assume it is a retransmission
    // and ignore the INVITE.
    // TODO: we should reply the last response.
    if (ua.transactions.ist[message.via_branch]) {
      return false;
    }
    // Otherwise check whether it is a merged request.
    else {
      for(idx in ua.transactions.ist) {
        tr = ua.transactions.ist[idx];
        if(tr.request.from_tag === fromTag && tr.request.call_id === call_id && tr.request.cseq === cseq) {
          reply(482);
          return false;
        }
      }
    }
  }
  // Non INVITE request.
  else {
    // If the branch matches the key of any NIST then assume it is a retransmission
    // and ignore the request.
    // TODO: we should reply the last response.
    if (ua.transactions.nist[message.via_branch]) {
      return false;
    }
    // Otherwise check whether it is a merged request.
    else {
      for(idx in ua.transactions.nist) {
        tr = ua.transactions.nist[idx];
        if(tr.request.from_tag === fromTag && tr.request.call_id === call_id && tr.request.cseq === cseq) {
          reply(482);
          return false;
        }
      }
    }
  }
}

// Sanity Check functions for responses
function rfc3261_8_1_3_3() {
  if(message.getHeaders('via').length > 1) {
    debug('more than one Via header field present in the response, dropping the response');
    return false;
  }
}

function rfc3261_18_3_response() {
  var
    len = Utils.str_utf8_length(message.body),
    contentLength = message.getHeader('content-length');

    if(len < contentLength) {
      debug('message body length is lower than the value in Content-Length header field, dropping the response');
      return false;
    }
}

// Sanity Check functions for requests and responses
function minimumHeaders() {
  var
    mandatoryHeaders = ['from', 'to', 'call_id', 'cseq', 'via'],
    idx = mandatoryHeaders.length;

  while(idx--) {
    if(!message.hasHeader(mandatoryHeaders[idx])) {
      debug('missing mandatory header field : ' + mandatoryHeaders[idx] + ', dropping the response');
      return false;
    }
  }
}

// Reply
function reply(status_code) {
  var to,
    response = 'SIP/2.0 ' + status_code + ' ' + JsSIP_C.REASON_PHRASE[status_code] + '\r\n',
    vias = message.getHeaders('via'),
    length = vias.length,
    idx = 0;

  for(idx; idx < length; idx++) {
    response += 'Via: ' + vias[idx] + '\r\n';
  }

  to = message.getHeader('To');

  if(!message.to_tag) {
    to += ';tag=' + Utils.newTag();
  }

  response += 'To: ' + to + '\r\n';
  response += 'From: ' + message.getHeader('From') + '\r\n';
  response += 'Call-ID: ' + message.call_id + '\r\n';
  response += 'CSeq: ' + message.cseq + ' ' + message.method + '\r\n';
  response += '\r\n';

  transport.send(response);
}

},{"./Constants":35,"./SIPMessage":52,"./Utils":59,"debug":11}]},{},[1]);
return bundle(id)})();