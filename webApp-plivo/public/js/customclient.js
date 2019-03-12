var audioChunks,rec, audioGraph, audioStreamContext, uioptions,
localStorage = window.localStorage;
var callStorage = {}, timer = "00:00:00";

const incomingNotifications = new Map();
let incomingNotificationAlert = null;

String.prototype.calltimer = function () {
    var sec_num = parseInt(this, 10);
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);
    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}
// cross browser foreach support
var _forEach = function(cb){
	for(var i=0; i<this.length; i++){
		cb(this[i]);
	}
}

if(typeof audioVisualize != "undefined"){
	audioGraph =  new audioVisualize('audio-local');
}
// UI tweaks
$('#makecall').attr('class', 'btn btn-success btn-block flatbtn disabled');

function date(){
	return (new Date()).toISOString().substring(0, 10)+" "+Date().split(" ")[4];
}
function kickStartNow(){
	$('.callScreen').hide();
	$('.loader').show();
	$('.fadein-effect').fadeIn(5000);	
}
function login(username, password) {
	if(username && password){
		//start UI load spinner
		kickStartNow();			
		plivoWebSdk.client.login(username, password);
		$('#sipUserName').html('sip:'+ username + '@' + plivoWebSdk.client.phone.configuration.hostport_params);
		document.querySelector('title').innerHTML = username;
	}else{
		console.error('username/password missing!')
	}
}
function audioDeviceChange(e){
	console.log('audioDeviceChange',e);
	if(e.change){
		if(e.change == "added"){
			customAlert(e.change,e.device.kind +" - "+e.device.label,'info');		
		}else{
			customAlert(e.change,e.device.kind +" - "+e.device.label,'warn');
		}
	}else{
		customAlert('info','There is an audioDeviceChange but mediaPermission is not allowed yet');
	}
}
function onPermissionNeeded(obj){
	console.log('onPermissionNeeded: ',obj);
	customAlert(obj.desc,obj.settings,'warn');
}

function onConnectionChange(obj){
	console.log('onConnectionChange: ', obj);
	if(obj.state === "connected" ){
		customAlert( obj.state , "info");
	}else if(obj.state === "disconnected"){
		customAlert( obj.state + " "+ obj.eventCode +" "+ obj.eventReason  , "info");
	}else{
		console.log("unknown connection state ");
	}
}

function onWebrtcNotSupported() {
	console.warn('no webRTC support');
	alert('Webrtc is not supported in this broswer, Please use latest version of chrome/firefox/opera/IE Edge');
}
function mediaMetrics(obj){
	/**
	* Set a trigger for Quality FB popup when there is an warning druing call using sessionStorage
	* During `onCallTerminated` event check for `triggerFB` flag
	*/
	sessionStorage.setItem('triggerFB',true);
	console.table([obj]);
	var classExist = document.querySelector('.-'+obj.type);
	var message = obj.type;
	/**
	* If there is a same audio level for 3 samples then we will get a trigger
	* If audio level is greater than 30 then it could be some continuous echo or user is not speaking
	* Set message "same level" for audio greater than 30. Less than 30 could be a possible mute  	
	*/
	if(obj.type.match('audio') && obj.value > 1){
		message = "same level";
	}
	if(obj.active){
		classExist? classExist.remove() : null; 
	$(".alertmsg").prepend(
	  '<div class="metrics -'+obj.type+'">' +
	  '<span style="margin-left:20px;">'+obj.level+' | </span>' +
	  '<span style="margin-left:20px;">'+obj.group+' | </span>' +
	  '<span style="margin-left:20px;">'+message+' - '+obj.value+' : </span><span >'+obj.desc+'</span>'+
	  '<span aria-hidden="true" onclick="closeMetrics(this)" style="margin-left:25px;cursor:pointer;">X</span>' +
	  '</div>'
	);
	}
	if(!obj.active && classExist){
		document.querySelector('.-'+obj.type).remove();
	}
	// Handle no mic input even after mic access
	if(obj.desc == "no access to your microphone"){
		$('#micAccessBlock').modal({ show: true })
	}
}

function onReady(){
	$('#phonestatus').html('trying to login...');
	console.info('Ready');
}
function onLogin(){
	$('#phonestatus').html('online');
	console.info('Logged in');
	$('#makecall').attr('class', 'btn btn-success btn-block flatbtn');
	$('#uiLogin').hide();
	$('#uiLogout').show();
	$('.feedback').show();
	$('.loader').remove();
	// show call rec url based on sipuser
	$('#callrecLink').attr('href','https://pxml.herokuapp.com/callrec.html?userId='+plivoWebSdk.client.userName);
}
function onLoginFailed(reason){
	$('#phonestatus').html('login failed');
	console.info('onLoginFailed ',reason);
	if(Object.prototype.toString.call(reason) == "[object Object]"){
		reason = JSON.stringify(reason);
	}
	customAlert('Login failure :',reason);
	$('.loader').remove()	
}
function onLogout(){
	$('#phonestatus').html('Offline');
	console.info('onLogout');
	window.location.href=window.location.origin + window.location.pathname + "?logout"
}
function onCalling(){
	$('#callstatus').html('Progress...');	
	console.info('onCalling');
}
function onCallRemoteRinging(callInfo){
  	if (callInfo) console.log(JSON.stringify(callInfo));
	$('#callstatus').html('Ringing...');
	console.info('onCallRemoteRinging');
}
function onMediaConnected(callInfo){
	if (callInfo) console.log(JSON.stringify(callInfo));
	if (callInfo && callInfo.direction === 'incoming') {
$('#callstatus').html('Answered');
	}
console.info('onMediaConnected');
}
function onCallAnswered(callInfo){
	console.info('onCallAnswered');
  if (callInfo) console.info(JSON.stringify(callInfo));
	$('#callstatus').html('Answered');
	$('.hangup').show();
  $('#makecall').hide();
  if (callInfo && callInfo.direction === 'incoming') {
    $('.inboundBeforeAnswer').hide();
    $('.AfterAnswer').show();
    $('#boundType').html('Inbound :');
		$('#callNum').html(callInfo.src);
		$('#callstatus').html('Connecting...');
    $('#callDuration').html('00:00:00');
    $('.callinfo').show();
    if (incomingNotifications.has(callInfo.callUUID)) {
      const incomingCall = incomingNotifications.get(callInfo.callUUID)
      incomingCall.hide();
      incomingNotifications.delete(callInfo.callUUID);
    }
  }
	// plivoWebSdk.client.logout();
	timer = 0;
  if (window.calltimer) clearInterval(window.calltimer);
	window.calltimer = setInterval(function(){
		timer = timer +1;
		$('#callDuration').html(timer.toString().calltimer());
	},1000);
	// audio Visualizer
	var pcObj = plivoWebSdk.client.getPeerConnection();
	if(pcObj.pc && micVisualizer.checked && !window.localStream){
		var stream = pcObj.pc.getLocalStreams()[0];
		audioGraph && audioGraph.start(stream);
	}
	// record calls if enabled
	recAudioFun(pcObj);
	
}
function onCallTerminated(evt, callInfo){
	$('#callstatus').html('Call Ended');
	console.info(`onCallTerminated ${evt}`);
	if(sessionStorage.getItem('triggerFB')){
		clearStars();
		$('#clickFeedback').trigger('click');
		// clear at end of every call
		sessionStorage.removeItem('triggerFB');
	}
  if (callInfo && callInfo.callUUID === plivoWebSdk.client.getCallUUID()) {
    console.info(JSON.stringify(callInfo));
    callOff(evt);
  } else if(!callInfo) {
    callOff(evt);
  }
	
}
function onCallFailed(reason, callInfo){
  if (callInfo) {
    console.log(JSON.stringify(callInfo));
    console.info(`onCallFailed ${reason} ${callInfo.callUUID} ${callInfo.direction}`);
  } else {
    console.info(`onCallFailed ${reason}`);
  }
	
	if(reason && /Denied Media/i.test(reason)){
    $('#callstatus').html('call failed');
		$('#mediaAccessBlock').modal('show');
	};
  if (!callInfo) {
    callOff(reason);
    return;
  }
  
  if (incomingNotifications.has(callInfo.callUUID)) {
    const incomingCall = incomingNotifications.get(callInfo.callUUID)
    incomingCall.hide();
    incomingNotifications.delete(callInfo.callUUID);
  }
  if (incomingNotifications.size === 0  && !plivoWebSdk.client.getCallUUID()) {
    callOff(reason);
  } else if (incomingNotifications.size === 0 && callInfo.direction === 'outgoing') {
    callOff(reason);
  }
}
function onMediaPermission(evt){
	console.info('onMediaPermission',evt);
	if(evt.error){
		customAlert('Media permission error',evt.error);
		if(client.browserDetails.browser == "chrome")
			$('#mediaAccessBlock').modal('show');
	}
	if(evt.status == "success" && evt.stream){
		audioGraph && audioGraph.start(window.localStream);
	}
}
function onIncomingCall(callerName, extraHeaders, callInfo){

	console.info('onIncomingCall : ', callerName, extraHeaders);
	callStorage.startTime = date();
	callStorage.mode = 'in';
	callStorage.num = callerName;
	// $('.callScreen').show();
	// $('.inboundBeforeAnswer').show();
  
	$('#makecall').hide();
	$('#callstatus').html('Ringing...');
  const incomingNotification = Notify.success(`Incoming Call: ${callerName}`)
  .button('Answer', () => {
    console.info('Call accept clicked');
    if (callInfo) {
      plivoWebSdk.client.answer(callInfo.callUUID);
    } else {
      plivoWebSdk.client.answer();
    }
  	
  })
  .button('Reject', () => {
    console.info('callReject');
    if (callInfo) {
      plivoWebSdk.client.reject(callInfo.callUUID);
    } else {
      plivoWebSdk.client.reject();
    }  
  })
  .button('Ignore', () => {
    console.info('call Ignored');
    if (callInfo) {
      plivoWebSdk.client.ignore(callInfo.callUUID);
    } else {
      plivoWebSdk.client.ignore();
    }
  });
  if (callInfo) {
    console.info(JSON.stringify(callInfo));
    incomingNotifications.set(callInfo.callUUID, incomingNotification);
  } else {
    incomingNotificationAlert = incomingNotification;
  }
  
}

function onIncomingCallCanceled(callInfo){
	if (callInfo) console.info(JSON.stringify(callInfo));
  let incomingCallNotification;
  if (callInfo) {
    incomingCallNotification = incomingNotifications.get(callInfo.callUUID);
    incomingNotifications.delete(callInfo.callUUID);
  } else if(incomingNotificationAlert) {
    incomingCallNotification = incomingNotificationAlert;
  }
  if (incomingCallNotification) {
    incomingCallNotification.hide();
  }
  if (incomingNotifications.size === 0 && !plivoWebSdk.client.getCallUUID()) {
    callOff();
  }
}

function callOff(reason){
	// if(typeof reason == "object"){
	// 	customAlert('Hangup',JSON.stringify(reason) );
	// }else if(typeof reason == "string"){
	// 	customAlert('Hangup',reason);
	// }
	$('.callScreen').hide();
	$('.inboundBeforeAnswer').hide();
	$('.AfterAnswer').hide();
	$('.outboundBeforeAnswer').hide();
	$('.hangup').hide();
	$('#makecall').show();
	resetMute();
	window.calltimer? clearInterval(window.calltimer) : false;
	callStorage.dur = timer.toString().calltimer();
	if(timer == "00:00:00" && callStorage.mode == "in"){
		callStorage.mode = "missed";
	}
	saveCallLog(callStorage);
	$('#callstatus').html('Idle');
	$('.callinfo').hide();
	callStorage={}; // reset callStorage
	timer = "00:00:00"; //reset the timer	
	setTimeout(function(){
		// rec calls
		window._localContext? window._localContext.suspend():null;
		rec && rec.state != "inactive" && rec.stop();
		// audio visuals
		audioGraph && audioGraph.stop();
	},3000);
	// stop connect tone
}


function closeMetrics(e){
	e.parentElement.remove();
}

function resetSettings(source){
	// You can use all your default settings to go in as options during sdk init
	var defaultSettings = {
		"debug":"ALL",
		"permOnClick":true,
		"codecs":[  "OPUS", "PCMU" ],
		"enableIPV6":false,
		"audioConstraints":{
		"optional":[ {
			"googAutoGainControl":false
			}]
		},
		"dscp":true,
		"enableTracking":true,
		"dialType":"conference",
    "allowMultipleIncomingCalls": true
	};
	var uiSettings = document.querySelector('#appSettings');
	uiSettings.value = JSON.stringify(defaultSettings);
	if(source == 'clickTrigger')
		localStorage.removeItem('plivosettings');
}

function refreshSettings(){
	var getSettings = localStorage.getItem('plivosettings');
	var uiSettings = document.querySelector('#appSettings');
	if(getSettings){
		uiSettings.value = getSettings;
		uioptions = JSON.parse(getSettings);
		return JSON.parse(getSettings);
	}else{
		uioptions = JSON.parse(uiSettings.value);
		return JSON.parse(uiSettings.value);
	}
}
function updateSettings(val){
	localStorage.setItem('plivosettings',val);
	console.log('plivosettings updated!')
}
function customAlert(header,alertMessage,type){
	var typeClass="";
	if(type == "info"){
		typeClass = "alertinfo";
	}else if(type == "warn"){
		typeClass = "alertwarn";
	}
	$(".alertmsg").prepend(
	  '<div class="customAlert'+' '+typeClass+'">' +
	  '<span style="margin-left:20px;">'+header+' | </span>' +
	  '<span style="margin-left:20px;">'+alertMessage+' </span>'+
	  '<span aria-hidden="true" onclick="closeMetrics(this)" style="margin-left:25px;cursor:pointer;">X</span>' +
	  '</div>'
	);
}

function updateAudioDevices(){
	// Remove existing options if any
	_forEach.call(document.querySelectorAll('#micDev option'), e=>e.remove());
	_forEach.call(document.querySelectorAll('#ringtoneDev option'), e=>e.remove());

	plivoWebSdk.client.audio.availableDevices()
	.then(function(e){
		e.forEach(function(dev){
			if(dev.label && dev.kind == "audioinput")
				$('#micDev').append('<option value='+dev.deviceId+'>'+dev.label+'</option>')
			if(dev.label && dev.kind == "audiooutput"){
				$('#ringtoneDev').append('<option value='+dev.deviceId+'>'+dev.label+'</option>');
				$('#speakerDev').append('<option value='+dev.deviceId+'>'+dev.label+'</option>')		
			}
		});
	})
	.catch(function(error){
		console.error(error);
	})
}

function clearStars(){
	var stars = document.querySelectorAll('.star');
    for (i = 0; i < stars.length; i++) {
      $(stars[i]).removeClass('selected');
    }
    _forEach.call(document.querySelectorAll('[name="callqualitycheck"]'), e=>{
    	e.checked? (e.checked=false): null;
    });
    sendFeedbackComment.value="";
}
function recAudioFun(pcObj){
	// Record calls in broswer
	if(recCallsRemote.checked || recCallsBoth.checked){
		audioChunks = [];
		var remote_stream = pcObj.pc.getRemoteStreams()[0],
			local_stream = pcObj.pc.getLocalStreams()[0];
		var playAudio = () => {
			let blob = new Blob(audioChunks,{'type':'audio/ogg'});
	        recPlayer.src = URL.createObjectURL(blob);
	        recPlayer.controls=true;
	        audioDownload.href = recPlayer.src;
	        audioDownload.download = 'callrec.ogg';
	        $('#recPlayerLayout').show();
		};					
	}

	if(recCallsBoth.checked){
		window._localContext? window._localContext.resume() : (window._localContext=new AudioContext);
		var audioTracks = [remote_stream.getAudioTracks()[0],local_stream.getAudioTracks()[0]];
		var sources = audioTracks.map(t => _localContext.createMediaStreamSource(new MediaStream([t])));
		var dest = _localContext.createMediaStreamDestination();
		sources.forEach(s=>s.connect(dest));
		rec = new MediaRecorder(dest.stream);
		console.info('recording both');	
	}
	if(recCallsRemote.checked){
		rec = new MediaRecorder(remote_stream);
		console.info('recording callee');

	}
	if(recCallsRemote.checked || recCallsBoth.checked){
		rec.ondataavailable = e => {
			audioChunks.push(e.data);
			if (rec.state == "inactive") 
				playAudio();
		}
		rec.start();		
	}
	return;
}

function checkBrowserComplaince(client){
	if(client.browserDetails.browser != "chrome"){
		document.querySelector('[data-target="#popAudioDevices"]').remove();
		document.querySelector('[data-target="#popCallRec"]').remove();
	}
}

function trimSpace(e){
	 e.value = e.value.replace(/[- ()]/g,'');
}

function callerIdAPI(username, id, type){
	$.get( "https://pxml.herokuapp.com/updateCallerId", {username:username, callerId:id, type:type}, function(e) {
		console.log( "success",e);
	})
	.done(function(e) {
		console.log( "done",e );
	})
	.fail(function(e) {
		console.log("fail",e);
	})	
}
function saveCallerId(){
	var id = setCallerIdInput.value;
	if(!id){
		console.warn('callerId you set is: '+id);
		return;
	}
	localStorage.setItem('setCallerId',id);
	console.log('setCallerId saved as :',localStorage.getItem('setCallerId'));
	if (plivoWebSdk.client.userName) {
		callerIdAPI(plivoWebSdk.client.userName, id, "add");
	}
	customAlert('callerId','saved: '+id,'info');
}

function removeCallerId(){
	localStorage.removeItem('setCallerId');
	var id = setCallerIdInput.value;
	console.debug('callerId removed');
	if (plivoWebSdk.client.userName) {
		callerIdAPI(plivoWebSdk.client.userName, id, "remove");
	}
	setCallerIdInput.value = "";
	customAlert('callerId','removed','info');
}
function callLogDiv(e){
	var mapper = {
		"in" : "arrow-down log-in",
		"out"	: "share-alt log-out",
		"missed": "arrow-down log-missed"
	}
	$('#callHistoryTable').prepend(
		'<tr>'+
			'<td><span class="glyphicon glyphicon-'+mapper[e.mode]+'"></span></td>'+
			'<td>'+e.num+'</td>'+
			'<td>'+e.dur+'</td>'+
			'<td>'+e.startTime+'</td>'+
			'<td><span class="glyphicon glyphicon-earphone log-call" data-dismiss="modal" onclick="makecallCallLog(this)"></span></button></td>'+
		'</tr>'
	);
	return;
}

function saveCallLog(e){
	var callLog = localStorage.getItem('pli_callHis');
	var formatCallLog = JSON.parse(callLog);
	var callLogStr;
	callLogDiv(e);
	if(formatCallLog.length > 50){
		formatCallLog.shift();// Pops first element
		console.info('Call log exceeded 50 rows, removing oldest log')
	}	
	formatCallLog.push({"mode":e.mode,"num":e.num,"dur":e.dur,"startTime":e.startTime});
	callLogStr = JSON.stringify(formatCallLog);
	localStorage.setItem('pli_callHis',callLogStr);
}

function displayCallHistory(){
	var callLog = localStorage.getItem('pli_callHis');
	if(callLog){
		var formatCallLog = JSON.parse(callLog);
		var mapper = {
			"in" : "right log-in",
			"out"	: "left log-out",
			"missed": "down log-missed"
		}		
		for(var i=0; i < formatCallLog.length; i++){
			callLogDiv(formatCallLog[i]);
		}
	}else{
		localStorage.setItem('pli_callHis','[]');
	}
}
function makecallCallLog(e){
	var to = e.parentNode.parentNode.childNodes[1].innerHTML;
	toNumber.value = to; // update the dial input 
	makecall.click(); // trigger call	
}
function resetMute(){
	tmute.setAttribute('data-toggle','mute');
	$('.tmute').attr('class', 'fa tmute fa-microphone');
}

//jwt tokengen fun
function tokenGenFunc(){
	return function(cb){
		$.get( "https://pxml.herokuapp.com/jwt", {userName:loginUser.value,min:10}, function(e) {
			console.log( "received token");
			cb(null,e);
		})
		.done(function(e) {
			console.log( "done");
		})
		.fail(function(e) {
			console.log("fail",e);
			cb('failed',null);
		});		
	}
}
/** 
* Hangup calls on page reload / close
* This is will prevent the other end still listening for dead call
*/
window.onbeforeunload = function () {
    // plivoWebSdk.client && plivoWebSdk.client.logout();
};

/*
	Capture UI onclick triggers 
*/
$('#inboundAccept').click(function(){
	console.info('Call accept clicked');
	plivoWebSdk.client.answer();
	$('.inboundBeforeAnswer').hide();
	$('.AfterAnswer').show();
});
$('#inboundReject').click(function(){
	console.info('callReject');
	plivoWebSdk.client.reject();
});
$('#outboundHangup').click(function(){
	console.info('outboundHangup');
	plivoWebSdk.client.hangup();
});
$('.hangup').click(function(){
	console.info('Hangup');
	if(plivoWebSdk.client.callSession){
		plivoWebSdk.client.hangup();
	}else{
		callOff();
	}
});

$('#tmute').click(function(e){
	var event = e.currentTarget.getAttribute('data-toggle');
	if(event == "mute"){
		plivoWebSdk.client.mute();
		e.currentTarget.setAttribute('data-toggle','unmute');
		$('.tmute').attr('class', 'fa tmute fa-microphone-slash')
	}else{
		plivoWebSdk.client.unmute();
		e.currentTarget.setAttribute('data-toggle','mute');
		$('.tmute').attr('class', 'fa tmute fa-microphone')
	}
});
$('#makecall').click(function(e){
	var to = $('#toNumber').val().replace(" ",""), 
		extraHeaders={}, dialType,
		customCallerId= localStorage.getItem('setCallerId'),
		customCallerIdEnabled = localStorage.getItem('setCallerIdCheck');
	if(customCallerIdEnabled && customCallerId){
		customCallerId = customCallerId.replace("+","");
		extraHeaders = {'X-PH-callerId': customCallerId};		
	}
	if(uioptions.dialType == "conference"){
		extraHeaders["X-PH-conference"] = "true";
	}
	var callEnabled = $('#makecall').attr('class').match('disabled');
	if(!to || !plivoWebSdk || !!callEnabled){return};
	if(!plivoWebSdk.client.isLoggedIn){alert('You\'re not Logged in!')}
	plivoWebSdk.client.call(to,extraHeaders);
	console.info('Click make call : ',to);
	callStorage.mode = "out";
	callStorage.startTime = date();
	callStorage.num = to;
	$('.callScreen').show();
	$('.AfterAnswer').show();
	$('#boundType').html('Outgoing :');
	$('#callNum').html(to);
	$('#callDuration').html('00:00:00');
	$('.callinfo').show();
	$('.hangup').show();
	$('#makecall').hide();
});

// Check caller Id if saved in localstorage
$('#setCallerIdMenu').click(function(){
	var localCallerId = localStorage.getItem('setCallerId');
	var localCallerIdChecked = localStorage.getItem('setCallerIdCheck');
	if(localCallerId){
		$('#setCallerIdInput').val(localCallerId);
	}
	if(localCallerIdChecked){
		setCallerIdCheck.checked=true;
	}
});

$('#setCallerIdCheck').click(function(){
	if(setCallerIdCheck.checked){
		localStorage.setItem('setCallerIdCheck',true);
		console.log('callerId enabled');
	}else{
		localStorage.removeItem('setCallerIdCheck');
		console.log('callerId disabled');
	}
});

$('#updateSettings').click(function(e){
	var appSettings = document.querySelector('#appSettings'); 
	appSettings = appSettings.value;
	updateSettings(appSettings);
});

$('#resetSettings').click(function(e){
	resetSettings('clickTrigger');
});

$('#clickClearAlerts').click(function(e){
	$('.alertmsg').html('');
});

$('#sendFeedback').click(function(){
	var score = $('#stars li.selected').last().data('value');
	score = Number(score);
	var lastCallid = plivoWebSdk.client.getLastCallUUID();
	var issues=[];
	_forEach.call(document.querySelectorAll('[name="callqualitycheck"]'), e=>{
		if(e.checked){
			issues.push(e.value);
		}
	});
	var note = sendFeedbackComment.value;
	var sendConsoleLogs = document.getElementById("sendConsoleLogs").checked;

	// New submitCallQualityFeedback takes parameteres callUUId, starRating, issues, note, sendConsoleLogs
	plivoWebSdk.client.submitCallQualityFeedback(lastCallid, score, issues, note, sendConsoleLogs)
	.then((result) => {
		$('#feedbackStatus').html('Feedback sent');
		$('#ignoreFeedback').click();
		customAlert('Feedback sent','','info');
	})
	.catch((error) => {
		$('#feedbackStatus').html(error);
		customAlert('Could not send feedback','','warn');
	});
});

$( "#ignoreFeedback" ).click(function() {		// Reset the feedback dialog for next time 
	$('#stars li').removeClass("selected");
	$('#sendFeedbackComment').empty();
	$('.lowQualityRadios input').prop('checked', false);
	$("#feedbackStatus").empty();
});

$('#clickLogin').click(function(e){
	var userName = $('#loginUser').val();
	var password = $('#loginPwd').val();
	login(userName, password);
	$('#uiLogout').click(function(e) {
		plivoWebSdk.client && plivoWebSdk.client.logout();

	});
});

// Audio device selection
$('#micDev').change(function(){
	var selectDev = $('#micDev').val();
	plivoWebSdk.client.audio.microphoneDevices.set(selectDev);
	console.debug('Microphone device set to : ',selectDev);
});
$('#speakerDev').change(function(){
	var selectDev = $('#speakerDev').val();
	plivoWebSdk.client.audio.speakerDevices.set(selectDev);
	console.debug('Speaker device set to : ',selectDev);
});
$('#ringtoneDev').change(function(){
	var selectDev = $('#ringtoneDev').val();
	plivoWebSdk.client.audio.ringtoneDevices.set(selectDev);
	console.debug('Ringtone dev set to : ',selectDev);
});

// Ringtone device test
$('#ringtoneDevTest').click(function(){
	var ringAudio = plivoWebSdk.client.audio.ringtoneDevices.media();
	// Toggle play
	if(ringAudio.paused){
		ringAudio.play();
		$('#ringtoneDevTest').html('Pause');
	}else{
		ringAudio.pause();
		$('#ringtoneDevTest').html('Play');
	}
});
// Speaker device test
$('#speakerDevTest').click(function(){
	var speakerAudio = plivoWebSdk.client.audio.speakerDevices.media();
	// Toggle play
	if(speakerAudio.paused){
		speakerAudio.play();
		$('#speakerDevTest').html('Pause');
	}else{
		speakerAudio.pause();
		$('#speakerDevTest').html('Play');
	}
});
//revealAudioDevices	
$('#allowAudioDevices').click(function(){
	_forEach.call(document.querySelectorAll('#popAudioDevices option'), e=>e.remove());
	plivoWebSdk.client.audio.revealAudioDevices()
	.then(function(e){
		updateAudioDevices();
		console.log('Media permission ',e)
	})
	.catch(function(error){
		console.error('media permission error :',error);
		$('#mediaAccessBlock').modal('show');
	})
});

$('.num').click(function () {
    var num = $(this);
    var text = $.trim(num.find('.txt').clone().children().remove().end().text());
    var telNumber = $('#toNumber');
    $(telNumber).val(telNumber.val() + text);
    if(plivoWebSdk && plivoWebSdk.client.callSession){
    	plivoWebSdk.client.sendDtmf(text);
    }
});

clearLogs.onclick = function(){
	localStorage.setItem('pli_callHis','[]');
	callHistoryTable.innerHTML=""
}

showPass.onclick = function(){
	if($('#showPass input').prop("checked")){
		loginPwd.type="text";
	}else{
		loginPwd.type="password";
	}
}

micTest.onclick = function(){
	function stopVisuals(){
		if(micStream && micStream.active){	
			micStream.getTracks().forEach(function(track) {
			  track.stop();
			});			
		}
	}
	// If its in test state
	if(!micTest.value){
		micTest.value = "stop"
		micTest.innerHTML = "Stop";
		$('<h4 id="micTestTip">You should see audio visuals on your screen now. If it doesn\'t apper then your broswer 	has some issues and you should restart your broswer </h4>').insertAfter('#micTest');
		plivoWebSdk.client.audio.revealAudioDevices('returnStream').then(stream=>{
			window.micStream = stream;
			micStream.oninactive = function(){
				micTest.innerHTML = "Test your microphone";
				micTest.value="";
				micTestTip.remove();			
				setTimeout(function(){
					audioGraph && audioGraph.stop();
				},1000);	
			}			
			audioGraph && audioGraph.start(stream,'micTestCanvas');
		})
		.catch(error=>{
			window.micStream = null;
			console.log(error)
		});
		setTimeout(function(){
			console.log('checking active micStream after 10 sec');
			stopVisuals();
		},10000);			
	}else{
		console.log('Stopping the mic test');
		stopVisuals();
	}
}

clearRecPlayer.onclick = function(){
	$('#recPlayerLayout').hide();
}
if(document.querySelector('#streamAudioFile')){
	streamAudioFile.onchange = function(){
		if(audioStreamContext){
			audioStreamContext.close();
		}
		audioRTC(function(e){
			console.log(e);
		})
	}
	toggleStreamAudioFile.onclick = function(){
		if(!audioStreamContext){
			return;
		}
		if(toggleStreamAudioFile.innerHTML == "Pause"){
			toggleStreamAudioFile.innerHTML = "Resume";
			audioStreamContext.suspend();
		}else{
			toggleStreamAudioFile.innerHTML = "Pause";
			audioStreamContext.resume();
		}
	}	
}

function audioRTC(cb){
  console.log('audioRTC()');
  window.audioStreamContext = new AudioContext();
  var file = streamAudioFile.files[0];
  if (file) {
    if (file.type.match('audio*')) {
      var reader = new FileReader();
        reader.onload = (function(readEvent) {
          audioStreamContext.decodeAudioData(readEvent.target.result, function(buffer) {
            // create an audio source and connect it to the file buffer
            var source = audioStreamContext.createBufferSource();
            source.buffer = buffer;
            source.start(0);
  
            // connect the audio stream to the audio hardware
            source.connect(audioStreamContext.destination);
 
            // create a destination for the remote browser
            var remote = audioStreamContext.createMediaStreamDestination();
 
            // connect the remote destination to the source
            source.connect(remote);
            window.localStream = remote.stream;
            cb({'status':'success','stream':true});
          });
        });
 
      reader.readAsArrayBuffer(file);
    }else{
    	alert('Use only audio files');
    }
  } 
}

function starFeedback(){
  //Visualizing things on Hover - See next part for action on click */
  $('#stars li').on('mouseover', function(){
    var onStar = parseInt($(this).data('value'), 10); // The star currently mouse on
    // Now highlight all the stars that's not after the current hovered star
    $(this).parent().children('li.star').each(function(e){
      if (e < onStar) {
        $(this).addClass('hover');
      }
      else {
        $(this).removeClass('hover');
      }
    });
  }).on('mouseout', function(){
    $(this).parent().children('li.star').each(function(e){
      $(this).removeClass('hover');
    });
  });
  
  //Action to perform on click */
  $('#stars li').on('click', function(){
    var onStar = parseInt($(this).data('value'), 10); // The star currently selected
    var stars = $(this).parent().children('li.star');
    
    for (i = 0; i < stars.length; i++) {
      $(stars[i]).removeClass('selected');
    }
    
    for (i = 0; i < onStar; i++) {
      $(stars[i]).addClass('selected');
    }
    
    var value = parseInt($('#stars li.selected').last().data('value'), 10);
	if(value < 5){
		$('.lowQualityRadios').show();
	}else{
		$('.lowQualityRadios').hide();
	}
    
  });	
}
// variables to declare 

var plivoWebSdk; // this will be retrived from settings in UI

function initPhone(username, password){
	var options = refreshSettings();
	plivoWebSdk = new window.Plivo(options);
	
	plivoWebSdk.client.on('onWebrtcNotSupported', onWebrtcNotSupported); 
	plivoWebSdk.client.on('onLogin', onLogin);
	// plivoWebSdk.client.on('onTokenRegister',onLogin);
	plivoWebSdk.client.on('onLogout', onLogout);
	plivoWebSdk.client.on('onLoginFailed', onLoginFailed);
	plivoWebSdk.client.on('onTokenEvent', onLoginFailed);
	plivoWebSdk.client.on('onCallRemoteRinging', onCallRemoteRinging);
	plivoWebSdk.client.on('onIncomingCallCanceled', onIncomingCallCanceled);
  plivoWebSdk.client.on('onIncomingCallIgnored', onIncomingCallCanceled);
	plivoWebSdk.client.on('onCallFailed', onCallFailed);
	plivoWebSdk.client.on('onMediaConnected', onMediaConnected);
	plivoWebSdk.client.on('onCallAnswered', onCallAnswered);
	plivoWebSdk.client.on('onCallTerminated', onCallTerminated);
	plivoWebSdk.client.on('onCalling', onCalling);
	plivoWebSdk.client.on('onIncomingCall', onIncomingCall);
	plivoWebSdk.client.on('onMediaPermission', onMediaPermission);
	plivoWebSdk.client.on('mediaMetrics',mediaMetrics);
	plivoWebSdk.client.on('audioDeviceChange',audioDeviceChange);
	plivoWebSdk.client.on('onPermissionNeeded', onPermissionNeeded); 
	plivoWebSdk.client.on('onConnectionChange', onConnectionChange); // To show connection change events

	// Methods 
	plivoWebSdk.client.setRingTone(true);
	plivoWebSdk.client.setRingToneBack(false);
	plivoWebSdk.client.setConnectTone(true); // Dial beep will play till we get alert response from network. 
	plivoWebSdk.client.setDebug("ALL"); // Allowed values are OFF, ERROR, WARN, INFO, DEBUG, ALL

	// plivoWebSdk.client.setConnectTone(false);
	/** Handle browser issues
	* Sound devices won't work in firefox
	*/
	checkBrowserComplaince(plivoWebSdk.client);	
	updateAudioDevices();
	displayCallHistory();
	starFeedback();
	console.log('initPhone ready!')
}
