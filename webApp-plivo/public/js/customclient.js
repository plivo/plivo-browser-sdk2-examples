var audioChunks,rec, audioStreamContext, uioptions,
localStorage = window.localStorage;
var callStorage = {}, timer = "00:00:00";

const incomingNotifications = new Map();
var speakerSourceNode;
var ringtoneSourceNode;
let incomingNotificationAlert = null;

var defaultSettings = {
	"debug":"INFO",
	"permOnClick":false,
	"codecs":[  "OPUS", "PCMU" ],
	"audioConstraints": {
		"optional": [
			{ "googAutoGainControl": true },
			{ "googEchoCancellation": true },
			{ "googNoiseSuppression": true }
		]
	},
	"dscp":true,
	"useDefaultAudioDevice":true,
	"enableTracking":true,
	"closeProtection":false,
	"maxAverageBitrate":48000,
	"allowMultipleIncomingCalls":false,
	"enableNoiseReduction":true,
	"usePlivoStunServer":true,
	"dtmfOptions":{sendDtmfType:["outband","inband"]} 
  };

var iti;
var incomingCallInfo;
var isIncomingCallPresent = false

var outputVolumeBar = document.getElementById('output-volume');
var inputVolumeBar = document.getElementById('input-volume');


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

// UI tweaks
$('#makecall').attr('class', 'btn btn-success btn-block flatbtn makecall disabled');

function date(){
	return (new Date()).toISOString().substring(0, 10)+" "+Date().split(" ")[4];
}

function kickStartNow(){
	$('.loader').show();
	$('.fadein-effect').fadeIn(5000);	
}

function login(username, password) {
	if(username && password){
		//start UI load spinner
		kickStartNow();			
		plivoBrowserSdk.client.login(username, password);
	}else{
		console.error('username/password missing!')
	}
}

function audioDeviceChange(e){
	console.log('audioDeviceChange',e);
	if(e.change){
		if(e.change == "added"){
			if (e.device.kind === 'audioinput') {
				setTimeout(() => {
					plivoBrowserSdk.client.audio.microphoneDevices.set(e.device.deviceId)
				}, 1000)
			} else {
				setTimeout(() => {
					plivoBrowserSdk.client.audio.speakerDevices.set(e.device.deviceId)
				}, 1000)
			}
			customAlert(e.change,e.device.kind +" - "+e.device.label,'info');		
		}else{
			customAlert(e.change,e.device.kind +" - "+e.device.label,'warn');		
		}
	}else{
		customAlert('info','There is an audioDeviceChange but mediaPermission is not allowed yet');
	}
}

function onPermissionDenied(cause,callinfo){
	console.log('onPermissionDenied: ',cause);
	customAlert(cause,'warn');
}

function onConnectionChange(obj){
	console.log('onConnectionChange received: ', obj);
	if(obj.state === "connected" ){
		console.log( obj.state , "info", 'info');
	}else if(obj.state === "disconnected"){
		if(obj.eventCode && obj.eventReason){
			customAlert( obj.state + " "+ obj.eventCode +" "+ obj.eventReason  , "info");
		}else if(obj.eventCode && !obj.eventReason){
			customAlert( obj.state + " "+ obj.eventCode, "info");
		}else if(!obj.eventCode && obj.eventReason){
			customAlert( obj.state + " "+ obj.eventReason  , "info");
		}else{
			customAlert( obj.state , "info");
		}
	}else{
		console.log("unknown connection state ");
	}
}

function onWebrtcNotSupported() {
	console.warn('no webRTC support');
	alert('Webrtc is not supported in this broswer, Please use latest version of chrome/firefox/opera/IE Edge');
}

function mediaMetrics(obj){
	console.log("WebRTC Media Metrics Received")
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
	let closeAlert = Math.random().toString(36).substring(7);
	$(".oncallalertmsg").append(
	  '<div id="alert'+closeAlert+'" class="metrics -'+obj.type+'">' +
	  '<span>'+obj.level+' | </span>' +
	  '<span>'+message+' : '+obj.value+' | </span><span >'+obj.desc+'</span>'+
	  '<span aria-hidden="true" onclick="closeMetrics(this)" style="margin-left:15px;cursor:pointer;">X</span>' +
	  '</div>'
	);
	setTimeout(function () {
        $('#'+'alert'+closeAlert).remove();
    }, 5000);
	}
	if(!obj.active && classExist){
		document.querySelector('.-'+obj.type).remove();
	}
	// Handle no mic input even after mic access
	if(obj.desc == "no access to your microphone"){
		$('#micAccessBlock').modal({ show: true })
	}
}


function remoteAudioStatus(hasAudio) {
	console.log("Received remoteAudioStatus is ", hasAudio)
	customAlert( `remoteAudioStatus: ${hasAudio}`, "info", 'info');
}

function handleOnDtmfReceived(data) {
	console.log('**DTMF Received:** Digit:', data);
}

function onReady(){
	$('#phonestatus').html('trying to login...');
	console.info('Ready');
}

function onLogin(){
	$('#loginContainer').hide();
	$('#callContainer').show();
	document.body.style.backgroundImage = 'none';
	let username = plivoBrowserSdk.client.userName;
	$('#sipUserName').html(username+'@'+plivoBrowserSdk.client.phone.configuration.hostport_params);
	document.querySelector('title').innerHTML = username;
	$('#phonestatus').html('online');
	console.info('Logged in');
	let customCallerId= localStorage.getItem('callerId')
	if(customCallerId) {
		let callerid = document.getElementById("callerid");
		callerid.value = customCallerId;
	}
	plivoBrowserSdk.client.audio.speakerDevices.set('default')
	$('#makecall').attr('class', 'btn btn-success btn-block flatbtn makecall');
	customAlert( "connected" , "info", 'info');
	$('.loader').hide();
}

function onLoginFailed(reason){
	console.info('onLoginFailed ',reason);
	if(Object.prototype.toString.call(reason) == "[object Object]"){
		reason = JSON.stringify(reason);
	}
	customAlert('Login failure :',reason, 'warn');
	$('.loader').hide()	
}

function onNoiseReductionReady()
{
	console.log("Noise Reduction is ready to be started")
	// You can start the Noise Reduction process after this event.
	// plivoBrowserSdk.client.startNoiseReduction();
}

function performLogout(){
	document.body.style.backgroundImage = 'url(img/background.svg)';
	$('#loginContainer').show();
	$('#callContainer').hide();
	$('.loader').hide();
	$('#toNumber').val("");
	iti.setCountry("us");
	localStorage.clear();
}
function onLogout(){
	console.info('onLogout');
	performLogout();
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

function onCallConnected(callInfo) {
        if (callInfo) console.log(JSON.stringify(callInfo));
        $('#callstatus').html('Connected...');
        console.info('onCallConnected');
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
	if (callInfo && callInfo.direction === 'incoming') {
		$('#phone').hide();
		$('#boundType').html('Incoming : '+callInfo.src);
		$('#callNum').html(callInfo.src);
		$('#callDuration').html('00:00:00');
		$('.callinfo').show();
		let noiseReduction = document.getElementById('ongoingNoiseReduction')
		document.getElementById('callanswerpad').appendChild(noiseReduction)
		if (incomingNotifications.has(callInfo.callUUID)) {
		const incomingCall = incomingNotifications.get(callInfo.callUUID)
		if (incomingCall)
			incomingCall.hide();
		incomingNotifications.delete(callInfo.callUUID);
		}
	}
	timer = 0;
	if (window.calltimer) clearInterval(window.calltimer);
	window.calltimer = setInterval(function(){
		timer = timer +1;
		$('#callDuration').html(timer.toString().calltimer());
	},1000);
}

function onCallTerminated(evt, callInfo){
	$('#callstatus').html('Call Ended');
	console.info('onCallTerminated', evt);
	clearStars();
	$('#sendQualityFeedback').modal('show');
	if (callInfo && callInfo.callUUID === plivoBrowserSdk.client.getCallUUID()) {
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
		if(incomingCall){ 
			incomingCall.hide();
		}
		incomingNotifications.delete(callInfo.callUUID);
	}
	if (incomingNotifications.size === 0  && !plivoBrowserSdk.client.getCallUUID()) {
		callOff(reason);
	} else if (incomingNotifications.size === 0 && callInfo.direction === 'outgoing') {
		callOff(reason);
	}
}

function onMediaPermission(evt){
	console.info('WebRTC onMediaPermission',evt);
	if(evt.error){
		customAlert('Media permission error',evt.error, 'warn');
		if(client.browserDetails.browser == "chrome")
			$('#mediaAccessBlock').modal('show');
	}
}

function onIncomingCall(callerName, extraHeaders, callInfo, caller_Name){
	console.info('onIncomingCall : ', callerName, extraHeaders, callInfo,caller_Name);
	let prevIncoming = isIncomingCallPresent;
	isIncomingCallPresent = true;
	callStorage.startTime = date();
	callStorage.mode = 'in';
	callStorage.num = caller_Name;
	if (document.getElementById('callstatus').innerHTML == 'Idle' && !prevIncoming) {
		$('#incomingCallDefault').show();
		$('#phone').hide();
		$('#callstatus').html('Ringing...');
		$('#callernum').html(caller_Name);
		incomingCallInfo = callInfo;
		if (callInfo) {
			incomingNotifications.set(callInfo.callUUID, null);
		} 
	} else {
		$('#callstatus').html('Ringing...');
		const incomingNotification = Notify.success(`Incoming Call: ${caller_Name}`)
		.button('Answer', () => {
			isIncomingCallPresent = false;
			console.info('Call accept clicked');
			if (callInfo) {
			plivoBrowserSdk.client.answer(callInfo.callUUID);
			} else {
			plivoBrowserSdk.client.answer();
			}  	
  	})
		.button('Reject', () => {
			isIncomingCallPresent = false;
			console.info('callReject');
			if (callInfo) {
			plivoBrowserSdk.client.reject(callInfo.callUUID);
			} else {
			plivoBrowserSdk.client.reject();
			}  
		})
		.button('Ignore', () => {
			isIncomingCallPresent = false;
			console.info('call Ignored');
			if (callInfo) {
			plivoBrowserSdk.client.ignore(callInfo.callUUID);
			} else {
			plivoBrowserSdk.client.ignore();
			}
		});
		if (callInfo) {
			console.info(JSON.stringify(callInfo));
			incomingNotifications.set(callInfo.callUUID, incomingNotification);
		} else {
			incomingNotificationAlert = incomingNotification;
		}
	}
}

function onIncomingCallCanceled(callInfo){
	console.info('**Incoming Call Canceled:** User canceled the incoming call.');
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
	if (incomingNotifications.size === 0 && !plivoBrowserSdk.client.getCallUUID()) {
		callOff();
	}	
}

function onIncomingCallIgnored(callInfo){
	console.info("onIncomingCallIgnored",callInfo);
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
	if (incomingNotifications.size === 0 && !plivoBrowserSdk.client.getCallUUID()) {
		callOff();
	}
}

function callOff(reason){
	$('.callinfo').hide();
	$('.incomingCallDefault').hide();
	showKeypadInfo();
	resetMute();
	window.calltimer? clearInterval(window.calltimer) : false;
	callStorage.dur = timer.toString().calltimer();
	if(timer == "00:00:00" && callStorage.mode == "in"){
		callStorage.mode = "missed";
	}
	$('#callstatus').html('Idle');
	callStorage={}; // reset callStorage
	timer = "00:00:00"; //reset the timer

}


function closeMetrics(e){
	e.parentElement.remove();
}

function resetSettings(){
	document.getElementById('loglevelbtn').value = "INFO"
	document.getElementById('onpageload').checked = true
	document.getElementById('monitorquality').checked = true
	document.getElementById('dontcloseprotect').checked = true
	document.getElementById('allowdscp').checked = true
	document.getElementById('noincoming').checked = true
	document.getElementById('msregionbtn').value = "AUTO"
	document.getElementById('averagebitrate').value = 48000
	localStorage.setItem('plivosettings',JSON.stringify(defaultSettings));
}

function refreshSettings(){
	var getSettings = localStorage.getItem('plivosettings');
	if(getSettings){
		var parsedSettings = JSON.parse(getSettings);
		document.getElementById('loglevelbtn').value = parsedSettings.debug;
		updateElementsInConfig(parsedSettings.permOnClick, 'oncallinit', 'onpageload');
		updateElementsInConfig(parsedSettings.enableTracking, 'monitorquality', 'dontmonitorquality');
		updateElementsInConfig(parsedSettings.closeProtection, 'closeprotect', 'dontcloseprotect');
		updateElementsInConfig(parsedSettings.dscp, 'allowdscp', 'nodscp');
		updateElementsInConfig(parsedSettings.allowMultipleIncomingCalls, 'allowincoming', 'noincoming');
		if(parsedSettings.clientRegion == null) {
			document.getElementById('msregionbtn').value = 'AUTO';
		} else {
			document.getElementById('msregionbtn').value = parsedSettings.clientRegion;
		}
		document.getElementById('averagebitrate').value = parsedSettings.maxAverageBitrate;
		uioptions = parsedSettings;
		return parsedSettings;
	}else{
		uioptions = defaultSettings;
		return defaultSettings;
	}
}

function updateSettings(val){
	let loglevel = document.getElementById('loglevelbtn').value;
	val.debug = loglevel;
	changeVal(val, document.getElementById('onpageload').checked, 'permOnClick', true);
	changeVal(val, document.getElementById('monitorquality').checked, "enableTracking", false);
	changeVal(val, document.getElementById('dontcloseprotect').checked, "closeProtection", true);
	changeVal(val, document.getElementById('allowdscp').checked, "dscp", false);
	changeVal(val, document.getElementById('noincoming').checked, "allowMultipleIncomingCalls", true);
	let clientRegion = document.getElementById('msregionbtn').value;
	if(clientRegion!='AUTO') {
		val.clientRegion = clientRegion;
	}
	let averagebitrate = document.getElementById('averagebitrate').value;
	val.maxAverageBitrate = parseInt(averagebitrate);
	localStorage.setItem('plivosettings',JSON.stringify(val));
	console.log('plivosettings updated!')
}

function updateElementsInConfig(access, element1, element2) {
	if(access) {
		document.getElementById(element1).checked = true
	} else {
		document.getElementById(element2).checked = true
	}
}

function changeVal(val, access, element, expected) {
	if(!access) {
		val[element] = expected;
	}
}

function customAlert(header,alertMessage,type){
	let closeAlert = Math.random().toString(36).substring(7);
	var typeClass="";
	if(type == "info"){
		typeClass = "alertinfo";
	}else if(type == "warn"){
		typeClass = "alertwarn";
	}
	$(".alertmsg").append(
	  '<div id="alert'+closeAlert+'" class="customAlert'+' '+typeClass+'">' +
	  '<span style="margin-left:20px;">'+header+' | </span>' +
	  '<span style="margin-left:20px;">'+alertMessage+' </span>'+
	  '<span aria-hidden="true" onclick="closeMetrics(this)" style="margin-left:25px;cursor:pointer;">X</span>' +
	  '</div>'
	);
	setTimeout(function () {
        $('#'+'alert'+closeAlert).remove();
    }, 5000);
}

function updateAudioDevices(){
	// Remove existing options if any
	_forEach.call(document.querySelectorAll('#micDev option'), e=>e.remove());
	_forEach.call(document.querySelectorAll('#inputDev option'), e=>e.remove());
	_forEach.call(document.querySelectorAll('#outputDev option'), e=>e.remove());
	_forEach.call(document.querySelectorAll('#ringtoneDev option'), e=>e.remove());
	currentSetMicDeviceId = plivoBrowserSdk.client.audio.microphoneDevices.get();
	currentSetRingToneDeviceId = plivoBrowserSdk.client.audio.ringtoneDevices.get();
	currentSetSpeakerDeviceId = plivoBrowserSdk.client.audio.speakerDevices.get();
	plivoBrowserSdk.client.audio.availableDevices()
	.then(function(e){
		e.forEach(function(dev){
			if(dev.label && dev.kind == "audioinput"){
				if (currentSetMicDeviceId == "" || currentSetMicDeviceId != dev.deviceId){
					$('#micDev').append('<option value='+dev.deviceId+'>'+dev.label+'</option>')
					$('#inputDev').append('<option value='+dev.deviceId+'>'+dev.label+'</option>')
				}
				else if(currentSetMicDeviceId == dev.deviceId){
					$('#micDev').append('<option value='+dev.deviceId+' selected >'+dev.label+'</option>')
					$('#inputDev').append('<option value='+dev.deviceId+' selected >'+dev.label+'</option>')
				}
			}
			if(dev.label && dev.kind == "audiooutput"){
				if (currentSetRingToneDeviceId == "" || currentSetRingToneDeviceId != dev.deviceId){
					$('#ringtoneDev').append('<option value='+dev.deviceId+'>'+dev.label+'</option>');
				}else if(currentSetRingToneDeviceId == dev.deviceId){
					$('#ringtoneDev').append('<option value='+dev.deviceId+' selected >'+dev.label+'</option>');
				}

				if(currentSetSpeakerDeviceId == "" || currentSetSpeakerDeviceId != dev.deviceId){
					$('#speakerDev').append('<option value='+dev.deviceId+'>'+dev.label+'</option>')
					$('#outputDev').append('<option value='+dev.deviceId+'>'+dev.label+'</option>')
				}
				else if(currentSetSpeakerDeviceId == dev.deviceId){
					$('#speakerDev').append('<option value='+dev.deviceId+' selected >'+dev.label+'</option>')
					$('#outputDev').append('<option value='+dev.deviceId+' selected >'+dev.label+'</option>')
				}		
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

function checkBrowserComplaince(client){
	if(client.browserDetails.browser != "chrome"){
		document.querySelectorAll('[href="#popAudioDevices"]').forEach(el => el.remove());
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

function saveCallerId(id){
	if(!id){
		console.warn('callerId you set is: '+id);
		customAlert('callerId','empty','warn');
		return;
	}
	localStorage.setItem('callerId',id);
	console.log('callerId saved as :',localStorage.getItem('callerId'));
	if (plivoBrowserSdk.client.userName) {
		callerIdAPI(plivoBrowserSdk.client.userName, id, "add");
	}
	customAlert('callerId','saved: '+id,'info');
}

function removeCallerId(){
	if (localStorage.hasOwnProperty('callerId')) {
		localStorage.removeItem('callerId');
		let id = document.getElementById('callerid');
		console.debug('callerId removed');
		if (plivoBrowserSdk.client.userName) {
			callerIdAPI(plivoBrowserSdk.client.userName, id.value, "remove");
		}
		id.value = "";
		customAlert('callerId','removed','info');
	} else {
		customAlert('callerId','not present','warn');
	}
}

function setIti(instance) {
	iti = instance;
}

function resetMute(){
	tmute.setAttribute('data-toggle','mute');
	$('.tmute').attr('class', 'fa tmute fa-microphone fa-lg callinfoIcon');
}

function volume(audioStats){
	inputVolume = audioStats.inputVolume;
	outputVolume =  audioStats.outputVolume;
	colorPids(Math.floor(inputVolume * 325), 'localaudio');
	colorPids(Math.floor(outputVolume * 325), 'remoteaudio');
}

function analyseAudio(volumeType) {
	navigator.mediaDevices.getUserMedia({ audio: true, video: false })
	.then(function(stream) {
	let audioContext = new AudioContext();
	let analyser = audioContext.createAnalyser();
	let microphone = audioContext.createMediaStreamSource(stream);
	let javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

	analyser.smoothingTimeConstant = 0.8;
	analyser.fftSize = 1024;

	microphone.connect(analyser);
	analyser.connect(javascriptNode);
	javascriptNode.connect(audioContext.destination);
	javascriptNode.onaudioprocess = function() {
		let array = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(array);
		let values = 0;

		let length = array.length;
		for (let i = 0; i < length; i++) {
			values += (array[i]);
		}
		let average = values / length;
		colorPids(average, volumeType);
	}
	})
	.catch(function(err) {
		console.log("Unable to get user media");
	});
}

function colorPids(vol, volumeType) {
	let all_pids = $('.pid'+volumeType);
	let amout_of_pids = Math.round(vol/10);
	let elem_range = all_pids.slice(0, amout_of_pids);
	for (let i = 0; i < all_pids.length; i++) {
	  all_pids[i].style.backgroundColor="#e6e7e8";
	}
	for (let j = 0; j < elem_range.length; j++) {
	  elem_range[j].style.backgroundColor="#69ce2b";
	}
}


function refreshAudioDevices() {
	_forEach.call(document.querySelectorAll('#popAudioDevices option'), e=>e.remove());
	plivoBrowserSdk.client.audio.revealAudioDevices()
	.then(function(e){
		updateAudioDevices();
		console.log('Media permission ',e)
	})
	.catch(function(error){
		console.error('media permission error :',error);
		$('#mediaAccessBlock').modal('show');
	})
}

function showOuputAudioLevel(volumeType) {
	let audioContext = new AudioContext();
	if (volumeType=='speakeroutput') {
		speakerSourceNode = audioContext.createBufferSource();
	} else {
		ringtoneSourceNode = audioContext.createBufferSource();
	}
	let request = new XMLHttpRequest();
	request.open('GET', 'media/us-ring.mp3', true);
	request.responseType = 'arraybuffer';
	// When loaded, decode the data and play the sound
	request.onload = function () {
		audioContext.decodeAudioData(request.response, function (buffer) {
			if (volumeType=='speakeroutput') {
				speakerSourceNode.buffer = buffer;
				speakerSourceNode.start(0);
				speakerSourceNode.loop = true;
			} else {
				ringtoneSourceNode.buffer = buffer;
				ringtoneSourceNode.start(0);
				ringtoneSourceNode.loop = true;
			}
		});
	}
	request.send();

	// Analyse audio
	let analyser = audioContext.createAnalyser();
	let javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
	analyser.smoothingTimeConstant = 0.8;
	analyser.fftSize = 64;
	if (volumeType=='speakeroutput') {
		speakerSourceNode.connect(audioContext.destination);
    	speakerSourceNode.connect(analyser);
	} else {
		ringtoneSourceNode.connect(audioContext.destination);
    	ringtoneSourceNode.connect(analyser);
	}
	analyser.connect(javascriptNode);
	javascriptNode.connect(audioContext.destination);
	javascriptNode.onaudioprocess = function() {
		let array = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(array);
		let values = 0;
		let length = array.length;
		for (let i = 0; i < length; i++) {
			values += (array[i]);
		}
		let average = values / (length/2);
		if (average!=0) {
			colorPids(average, volumeType);
		}
	}
}

function stopOutputAudioLevel(volumeType) {
	if(volumeType=='speakeroutput') {
		speakerSourceNode.stop(0);
	}
	if(volumeType=='ringoutput') {
		ringtoneSourceNode.stop(0);
	}
}

function hideKeypadInfo() {
	$('.iti').hide();
	$('#toNumber').hide();
	$('.calleridinfo').hide();
	$('#makecall').hide();
	$('.micsettingslink').hide();
}

function showKeypadInfo() {
	var phone = document.getElementById('phone');
	phone.style.removeProperty("width");
	phone.style.removeProperty("margin-left");
	document.getElementById('loginkeypad').appendChild(phone);
	$('#phone').show();
	$('.callinfo').hide();
	$('.iti').show();
	$('#toNumber').show();
	$('.calleridinfo').show();
	$('#makecall').show();
	$('.micsettingslink').show();
	document.getElementById('noiseReduction').appendChild(document.getElementById('ongoingNoiseReduction'))
	document.getElementById('showKeypad').value = 'showKeypad';
	$('#showKeypad').html('SHOW KEYPAD');
}


/*
	Capture UI onclick triggers 
*/


$('.hangup').click(function(){
	console.info('Hangup');
	if(plivoBrowserSdk.client.callSession){
		plivoBrowserSdk.client.hangup();
	    showKeypadInfo();
	}else{
		callOff();
	}
});

$('.answerIncoming').click(function(){
	isIncomingCallPresent = false;
	console.info('Call accept clicked');
	if (incomingCallInfo) {
	plivoBrowserSdk.client.answer(incomingCallInfo.callUUID);
	} else {
	plivoBrowserSdk.client.answer();
	}
	$('.incomingCallDefault').hide();
	$('.callinfo').show();
});

$('.rejectIncoming').click(function(){
	isIncomingCallPresent = false;
	console.info('Call rejected');
	if (incomingCallInfo) {
		plivoBrowserSdk.client.reject(incomingCallInfo.callUUID);
	} else {
		plivoBrowserSdk.client.reject();
	}
	$('.incomingCallDefault').hide();
});

$('.ignoreIncoming').click(function(){
	isIncomingCallPresent = false;
	console.info('Call ignored');
	if (incomingCallInfo) {
		plivoBrowserSdk.client.ignore(incomingCallInfo.callUUID);
	} else {
		plivoBrowserSdk.client.ignore();
	}
	$('.incomingCallDefault').hide();
});

$('#tmute').click(function(e){
	var event = e.currentTarget.getAttribute('data-toggle');
	if(event == "mute"){
		plivoBrowserSdk.client.mute();
		e.currentTarget.setAttribute('data-toggle','unmute');
		$('.tmute').attr('class', 'fa tmute fa-microphone-slash fa-lg callinfoIcon')
	}else{
		plivoBrowserSdk.client.unmute();
		e.currentTarget.setAttribute('data-toggle','mute');
		$('.tmute').attr('class', 'fa tmute fa-microphone fa-lg callinfoIcon')
	}
});

$('#makecall').click(function(e){
	var to = iti.getNumber(),
		extraHeaders={},
		customCallerId= localStorage.getItem('callerId');
	if(customCallerId){
		customCallerId = customCallerId.replace("+","");
		extraHeaders = {'X-PH-callerId': customCallerId};		
	}
	extraHeaders["X-PH-conference"] = "true";
	var callEnabled = $('#makecall').attr('class').match('disabled');
	if(!to || !plivoBrowserSdk || !!callEnabled){return};
	if(!plivoBrowserSdk.client.isLoggedIn){alert('You\'re not Logged in!')}
	plivoBrowserSdk.client.call(to,extraHeaders);
	console.info('Click make call : ',to);
	callStorage.mode = "out";
	callStorage.startTime = date();
	callStorage.num = to; 
	$('.phone').hide();
	let noiseReduction = document.getElementById('ongoingNoiseReduction')
		document.getElementById('callanswerpad').appendChild(noiseReduction)
	$('.AfterAnswer').show();
	$('#boundType').html('Outgoing : '+to);
	$('#callDuration').html('00:00:00');
	$('.callinfo').show();
});

$('#updateSettings').click(function(e){
	updateSettings(defaultSettings);	

});

$('#resetSettings').click(function(e){
	resetSettings();
});

$('#saveCallerId').click(function(e){
	let callerid = document.getElementById('callerid').value;
	saveCallerId(callerid);
});

$('#removeCallerId').click(function(e){
	removeCallerId();
});

$('#clickClearAlerts').click(function(e){
	$('.alertmsg').html('');
});

$('#sendFeedback').click(function(){
	var score = $('#stars li.selected').last().data('value');
	score = Number(score);
	var lastCallid = plivoBrowserSdk.client.getLastCallUUID();
	var issues=[];
	_forEach.call(document.querySelectorAll('[name="callqualitycheck"]'), e=>{
		if(e.checked){
			issues.push(e.value);
		}
	});
	var note = sendFeedbackComment.value;
	var sendConsoleLogs = document.getElementById("sendConsoleLogs").checked;

	// submitCallQualityFeedback takes parameteres callUUId, starRating, issues, note, sendConsoleLogs
	plivoBrowserSdk.client.submitCallQualityFeedback(lastCallid, score, issues, note, sendConsoleLogs)
	.then((result) => {
		$('#feedbackStatus').html('Feedback sent');
		$('#ignoreFeedback').click();
		customAlert('Feedback sent','','info');
		$('.lowQualityRadios').hide();
	})
	.catch((error) => {
		$('#feedbackStatus').html(error);
		customAlert('Could not send feedback','','warn');
	});
});

// Reset the feedback dialog when ignore clicked
$( "#ignoreFeedback" ).click(function() { 
	$('#stars li').removeClass("selected");
	$('#sendFeedbackComment').empty();
	$('.lowQualityRadios input').prop('checked', false);
	$("#feedbackStatus").empty();
	$('.lowQualityRadios').hide();
});

// Reset the feedback dialog when modal closed
$('#sendQualityFeedback').on('hidden.bs.modal', function () {
    $('#stars li').removeClass("selected");
	$('#sendFeedbackComment').empty();
	$('.lowQualityRadios input').prop('checked', false);
	$("#feedbackStatus").empty();
	$('.lowQualityRadios').hide();
});

$('.logout').click(function(e) {
	//start UI load spinner
	kickStartNow();	
	plivoBrowserSdk.client && plivoBrowserSdk.client.logout();

});

$('#clickLogin').click(function(e){
	var userName = $('#loginUser').val();
	var password = $('#loginPwd').val();
	login(userName, password);
});



// Audio device selection
$('#micDev').change(function(){
	var selectDev = $('#micDev').val();
	plivoBrowserSdk.client.audio.microphoneDevices.set(selectDev);
	console.debug('Microphone device set to : ',selectDev);
});

$('#speakerDev').change(function(){
	var selectDev = $('#speakerDev').val();
	plivoBrowserSdk.client.audio.speakerDevices.set(selectDev);
	console.debug('Speaker device set to : ',selectDev);
});

$('#ringtoneDev').change(function(){
	var selectDev = $('#ringtoneDev').val();
	plivoBrowserSdk.client.audio.ringtoneDevices.set(selectDev);
	console.debug('Ringtone dev set to : ',selectDev);
});

$('#inputDev').change(function(){
	var selectDev = $('#inputDev').val();
	plivoBrowserSdk.client.audio.microphoneDevices.set(selectDev);
	console.debug('Microphone device set to : ',selectDev);
});
$('#outputDev').change(function(){
	var selectDev = $('#outputDev').val();
	plivoBrowserSdk.client.audio.speakerDevices.set(selectDev);
	console.debug('Speaker device set to : ',selectDev);
});

// Ringtone device test
$('#ringtoneDevTest').click(function(){
	let ringtoneVal = document.getElementById('ringtoneDevTest').innerText;
	// Toggle Test
	if(ringtoneVal=='Test') {
		showOuputAudioLevel('ringoutput');
		$('#ringtoneDevTest').html('Stop');
	} else if(ringtoneVal=='Stop') {
		stopOutputAudioLevel('ringoutput');
		$('#ringtoneDevTest').html('Test');
	}
});

// Speaker device test
$('#speakerDevTest').click(function(){
	let speakerVal = document.getElementById('speakerDevTest').innerText;
	// Toggle Test
	if(speakerVal=='Test') {
		showOuputAudioLevel('speakeroutput');
		$('#speakerDevTest').html('Stop');
	} else if(speakerVal=='Stop') {
		stopOutputAudioLevel('speakeroutput');
		$('#speakerDevTest').html('Test');
	}
});

//revealAudioDevices	
$('#allowAudioDevices').click(function(){
	refreshAudioDevices();
});

$('.micsettingslink').click(function(){
	refreshAudioDevices();
	analyseAudio('input');
});

$('#miclink').click(function(){
	refreshAudioDevices();
});

$('#showKeypad').click(function(){
	let keypadVal = document.getElementById('showKeypad').value;
	if (keypadVal=='showKeypad') {
		var phone = document.getElementById('phone');
		document.getElementById('callanswerpad').appendChild(phone);
		phone.style.width="80%";
		phone.style.marginLeft="13%";
		$('#phone').show();
		hideKeypadInfo();
		document.getElementById('showKeypad').value = 'hideKeypad';
		$('#showKeypad').html('HIDE KEYPAD');
	}
	else if (keypadVal=='hideKeypad') {
		$('#phone').hide();
		document.getElementById('showKeypad').value = 'showKeypad';
		$('#showKeypad').html('SHOW KEYPAD');
	}
});

$('.num').click(function () {
    var num = $(this);
    var text = $.trim(num.find('.txt').clone().children().remove().end().text());
    var telNumber = $('#toNumber');
    $(telNumber).val(telNumber.val() + text);
    if(plivoBrowserSdk && plivoBrowserSdk.client.callSession){
    	plivoBrowserSdk.client.sendDtmf(text);
    }
});

function starFeedback(){
  $('#stars li').on('mouseover', function(){
    var onStar = parseInt($(this).data('value'), 10); // The star currently mouse on
    // Now highlight all the stars after the current hovered star
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

var plivoBrowserSdk; // this will be retrived from settings in UI

function initPhone(username, password){
	var options = refreshSettings();
	plivoBrowserSdk = new window.Plivo(options);

	plivoBrowserSdk.client.on('onWebrtcNotSupported', onWebrtcNotSupported); 
	plivoBrowserSdk.client.on('onLogin', onLogin);
	plivoBrowserSdk.client.on('onLogout', onLogout);
	plivoBrowserSdk.client.on('onLoginFailed', onLoginFailed);
	plivoBrowserSdk.client.on('onCallRemoteRinging', onCallRemoteRinging);
	plivoBrowserSdk.client.on('onCallConnected', onCallConnected);
	plivoBrowserSdk.client.on('onIncomingCallCanceled', onIncomingCallCanceled);
    plivoBrowserSdk.client.on('onIncomingCallIgnored', onIncomingCallIgnored);
	plivoBrowserSdk.client.on('onCallFailed', onCallFailed);
	plivoBrowserSdk.client.on('onMediaConnected', onMediaConnected);
	plivoBrowserSdk.client.on('onCallAnswered', onCallAnswered);
	plivoBrowserSdk.client.on('onCallTerminated', onCallTerminated);
	plivoBrowserSdk.client.on('onCalling', onCalling);
	plivoBrowserSdk.client.on('onIncomingCall', onIncomingCall);
	plivoBrowserSdk.client.on('onMediaPermission', onMediaPermission);
	plivoBrowserSdk.client.on('remoteAudioStatus', remoteAudioStatus);
	plivoBrowserSdk.client.on('mediaMetrics',mediaMetrics);
	plivoBrowserSdk.client.on('audioDeviceChange',audioDeviceChange);
	plivoBrowserSdk.client.on('onPermissionDenied', onPermissionDenied);
	plivoBrowserSdk.client.on('onNoiseReductionReady', onNoiseReductionReady); 
	plivoBrowserSdk.client.on('onConnectionChange', onConnectionChange); // To show connection change events
	plivoBrowserSdk.client.on('onDtmfReceived', handleOnDtmfReceived);
	plivoBrowserSdk.client.on('volume', volume);
	//onSessionExpired

	// Methods 
	plivoBrowserSdk.client.setRingTone(true);
	plivoBrowserSdk.client.setRingToneBack(false);
	plivoBrowserSdk.client.setConnectTone(true); // Dial beep will play till we get alert response from network. 
	plivoBrowserSdk.client.setDebug("ALL"); // Allowed values are OFF, ERROR, WARN, INFO, DEBUG, ALL
	$("#toggleButton").change(function () {
		if (this.checked) {
			// Button is checked (toggled on)
			plivoBrowserSdk.client.startNoiseReduction()
		} else {
			// Button is not checked (toggled off)
			plivoBrowserSdk.client.stopNoiseReduction()
		}
	});

	/** Handle browser issues
	* Sound devices won't work in firefox
	*/
	checkBrowserComplaince(plivoBrowserSdk.client);	
	starFeedback();
	console.log('initPhone ready!')
}
