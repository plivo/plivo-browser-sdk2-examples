var plivoWebSdk;

function webrtcNotSupportedAlert() {
  $('#txtStatus').text("");
  alert("Your browser doesn't support WebRTC. You need Chrome 25 to use this demo");
}

function isNotEmpty(n) {
  return n.length > 0;
}

function initUI() {
  //callbox
  $('#callcontainer').hide();
  $('#btn-container').hide();
  $('#status_txt').text('Waiting login');
  $('#login_box').show();
  $('#logout_box').hide();
}

function callUI() {
  //show outbound call UI
  dialpadHide();
  $('#incoming_callbox').hide('slow');
  $('#callcontainer').show();
  $('#status_txt').text('Ready');
  $('#make_call').text('Call');
}

function IncomingCallUI() {
  //show incoming call UI
  $('#status_txt').text('Incoming Call');
  $('#callcontainer').hide('slow');
  $('#incoming_callbox').show('slow');
}

function callAnsweredUI() {
  $('#incoming_callbox').hide('slow');
  $('#callcontainer').hide('slow');
  dialpadShow();
}

function mediaMetrics(obj){
  console.info(obj);
  $("body").prepend(
      '<div class="tools metrics">' +
      '<span style="margin-left:20px;">'+obj.level+' | </span>' +
      '<span style="margin-left:20px;">'+obj.group+' : </span><span >'+obj.type+'</span>'+
      '<span aria-hidden="true" onclick="closeMetrics(this)" style="margin-left:25px;cursor:pointer;">X</span>' +
      '</div>'
  );  
}
function closeMetrics(e){
 document.querySelector('.tools').remove();
}

function login() {
  $('#status_txt').text('');
  plivoWebSdk.client.login($("#username").val(), $("#password").val());
}

function logout() {
  plivoWebSdk.client.logout();
}

function onLogin() {
  $('#status_txt').text('Logged in');
  $('#login_box').hide();
  $('#logout_box').show();
  $('#callcontainer').show();
}

function onLoginFailed(error) {
  console.log(error);
  $('#status_txt').text("Login Failed: " + error);
}

function onLogout() {
  initUI();
}

function onCalling() {
  $('#status_txt').text('Call Connecting');
}

function onCallRemoteRinging() {
  $('#status_txt').text('Call In Progress');
  console.log('on call remote ringing');
}

function onCallAnswered() {
  callAnsweredUI();
  $('#status_txt').text('Call In Progress');
}

function onCallTerminated() {
  callUI();
}

function onCallFailed(cause) {
  callUI();
  $('#status_txt').text("Call Failed:"+cause);
}

function call() {
  if ($('#make_call').text() === "Call") {
    var dest = $("#to").val();
    if (isNotEmpty(dest)) {
      $('#status_txt').text('Calling..');
      var extraHeaders = {'X-PH-Test1': 'test1', 'X-PH-Test2': 'test2'};
      plivoWebSdk.client.call(dest, extraHeaders);
      $('#make_call').text('End');
    }
    else{
      $('#status_txt').text('Invalid Destination');
    }

  }
  else if($('#make_call').text() == "End") {
    $('#status_txt').text('Ending..');
    plivoWebSdk.client.hangup();
    $('#make_call').text('Call');
    $('#status_txt').text('Ready');
  }
}

function hangup() {
  $('#status_txt').text('Hanging up..');
  plivoWebSdk.client.hangup();
  callUI()
}

function dtmf(digit) {
  plivoWebSdk.client.sendDtmf(digit);
}
function dialpadShow() {
  $('#btn-container').show();
}

function dialpadHide() {
  $('#btn-container').hide();
}

function mute() {
  plivoWebSdk.client.mute();
  $('#linkUnmute').show('slow');
  $('#linkMute').hide('slow');
}

function unmute() {
  plivoWebSdk.client.unmute();
  $('#linkUnmute').hide('slow');
  $('#linkMute').show('slow');
}

function onIncomingCall(account_name, extraHeaders) {
  IncomingCallUI();
}

function onIncomingCallCanceled() {
  callUI();
}

function  onMediaPermission (result) {
  if (result) {
    console.log("get media permission");
  } else {
    alert("you don't allow media permission, you will can't make a call until you allow it");
  }
}

function onWebrtcNotSupported () {
  console.log("Your browser does not support web rtc");
  alert("Your browser does not support web rtc");
}

function answer() {
  console.log("answering")
  $('#status_txt').text('Answering....');
  plivoWebSdk.client.answer();
  callAnsweredUI()
}

function reject() {
  callUI();
  plivoWebSdk.client.reject();
}

$(document).ready(function() {
  //initialize sdk
  var options = {
    debug: 'DEBUG',
    permOnClick: false,
    enableIPV6: false,
    codecs: ['PCMU', 'OPUS'],
    audioConstraints: {
      optional: [ { googAutoGainControl: false } ]
    },
    enableTracking: true,
    appId: '110',
    appSecret: 'aCNdskhfkasdh0mohbJ'
  };
  plivoWebSdk = new window.Plivo(options);

  //event registration
  plivoWebSdk.client.on('onWebrtcNotSupported', onWebrtcNotSupported);
  plivoWebSdk.client.on('onLogin', onLogin);
  plivoWebSdk.client.on('onLogout', onLogout);
  plivoWebSdk.client.on('onLoginFailed', onLoginFailed);
  plivoWebSdk.client.on('onCallRemoteRinging', onCallRemoteRinging);
  plivoWebSdk.client.on('onIncomingCallCanceled', onIncomingCallCanceled);
  plivoWebSdk.client.on('onCallFailed', onCallFailed);
  plivoWebSdk.client.on('onCallAnswered', onCallAnswered);
  plivoWebSdk.client.on('onCallTerminated', onCallTerminated);
  plivoWebSdk.client.on('onCalling', onCalling);
  plivoWebSdk.client.on('onIncomingCall', onIncomingCall);
  plivoWebSdk.client.on('onMediaPermission', onMediaPermission);
  plivoWebSdk.client.on('mediaMetrics',mediaMetrics);

});
