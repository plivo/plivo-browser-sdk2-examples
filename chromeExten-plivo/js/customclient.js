/*
	Chrome extension tweaks
	1. support localstorage
	2. load external URL
*/
var localStorage = (typeof chrome != 'undefined' && chrome.storage) ? chrome.storage.local : window.localStorage;
(function(){
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function(){
		// console.log('Plivo xhr.readyState',xhr.readyState,' xhr.status: ',xhr.status, " document.readyState: ",document.readyState);
		if(xhr.readyState == 4 && xhr.status == 200){
			if(document.readyState == "complete"){
				setTimeout(PlivoJsReady,50);
			}else{
				document.onreadystatechange = function(e){
					if(document.readyState == "complete"){
						PlivoJsReady();
					}
				}
			}
		}
	}
	xhr.open('GET', 'https://s3.amazonaws.com/plivosdk-backup/sdk/browser/v2/plivo-2.0.9-beta.min.js', true);
	xhr.responseType = 'blob';
	xhr.onload = function(e) {
		var ps = document.createElement('script'); 
		ps.type = 'text/javascript'; 
		ps.src= window.URL.createObjectURL(this.response);
		ps.async=true;
		var s = document.getElementsByTagName('script')[0]; 
		s.parentNode.insertBefore(ps, s);
	};
	xhr.send();
})();

var callStorage = {}, timer = "00:00:00";
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
			$('#sipUserName').html('sip:'+username+'@'+plivoWebSdk.client.phone.configuration.hostport_params);
			document.querySelector('title').innerHTML=username;
		}else{
			console.error('username/password missing!')
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
	var message = obj.type;
	var classExist = document.querySelector('.-'+obj.type);

	/**
	* If there is a same audio level for 3 samples then we will get a trigger
	* If audio level is greater than 30 then it could be some continuous echo or user is not speaking
	* Set message "same level" for audio greater than 30. Less than 30 could be a possible mute  	
	*/
	if(obj.type.match('audio') && obj.value > 30){
		message = "same level";
	}
	if(obj.active){
		classExist? classExist.remove() : null; 
		$(".alertmsg").prepend(
		  '<div class="metrics -'+obj.type+'">' +
		  '<span style="margin-left:20px;">'+obj.level+' | </span>' +
		  '<span style="margin-left:20px;">'+obj.group+' | </span>' +
		  '<span style="margin-left:20px;">'+message+' - '+obj.desc+' : </span><span >'+obj.value+'</span>'+
		  '<span aria-hidden="true" class="closeMediaMetrics" style="margin-left:25px;cursor:pointer;">X</span>' +
		  '</div>'
		);
		$('.closeMediaMetrics').click(function(){
			$('.metrics').remove();
		});
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
}
function onLoginFailed(reason){
	$('#phonestatus').html('login failed');
	console.info('onLoginFailed ',reason);
	customAlert('Login failure :',reason);
	$('.loader').remove()	
}
function onLogout(){
	$('#phonestatus').html('Offline');
	console.info('onLogout');
}
function onCalling(){
	$('#callstatus').html('Progress...');	
	console.info('onCalling');
}
function onCallRemoteRinging(){
	$('#callstatus').html('Ringing...');
	console.info('onCallRemoteRinging');
}
function onCallAnswered(){
	console.info('onCallAnswered');
	$('#callstatus').html('Answered');
	$('.hangup').show();
	timer = 0;
	window.calltimer = setInterval(function(){
		timer = timer +1;
		$('#callDuration').html(timer.toString().calltimer());
	},1000);
}
function onCallTerminated(){
	$('#callstatus').html('Call Ended');
	console.info('onCallTerminated');
	if(sessionStorage.getItem('triggerFB')){
		$('#clickFeedback').trigger('click');
		// clear at end of every call
		sessionStorage.removeItem('triggerFB');
	}
	callOff();
}
function onCallFailed(reason){
	$('#callstatus').html('call failed');
	console.info('onCallFailed',reason);
	if(reason && /Denied Media/i.test(reason)){
		$('#mediaAccessBlock').modal('show');
	};
	callOff();
}
function onMediaPermission(evt){
	console.info('onMediaPermission',evt);
	if(evt.error){
		customAlert('Media permission error',evt.error);
		$('#mediaAccessBlock').modal('show');
	}
}
function onIncomingCall(callerName, extraHeaders){
	console.info(callerName, extraHeaders);
	callStorage.startTime = date();
	callStorage.mode = 'in';
	callStorage.num = callerName;
	$('#boundType').html('Incomming :');
	$('#callNum').html(callerName);
	$('#callDuration').html('00:00:00');
	$('.callinfo').show();
	$('.callScreen').show();
	$('.inboundBeforeAnswer').show();
	$('#makecall').hide();
}
function onIncomingCallCanceled(){
	console.info('onIncomingCallCanceled');
	callOff();
}

function callOff(){
	$('.callScreen').hide();
	$('.inboundBeforeAnswer').hide();
	$('.AfterAnswer').hide();
	$('.outboundBeforeAnswer').hide();
	$('.hangup').hide();
	$('#makecall').show();
	window.calltimer? clearInterval(window.calltimer) : false;
	callStorage.dur = timer.toString().calltimer();
	if(timer == "00:00:00" && callStorage.mode == "in"){
		callStorage.mode = "missed";
	}
	$('#callstatus').html('Idle');
	$('.callinfo').hide();
	callStorage={}; // reset callStorage
	timer = "00:00:00"; //reset the timer
}

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

function resetSettings(source){
	// You can use all your default settings to go in as options during sdk init
	var defaultSettings = {"debug":"DEBUG","permOnClick":true,"codecs":["OPUS","PCMU"],"enableIPV6":false,"audioConstraints":{"optional":[{"googAutoGainControl":false},{"googEchoCancellation":false}]},"dscp":true,"enableTracking":true}
	var uiSettings = document.querySelector('#appSettings');
	uiSettings.value = JSON.stringify(defaultSettings);
	if(source == 'clickTrigger')
		localStorage.plivosettings="";
}

function refreshSettings(){
	var getSettings = localStorage.plivosettings;
	var uiSettings = document.querySelector('#appSettings');
	if(getSettings){
		uiSettings.value = getSettings;
		return JSON.parse(getSettings);
	}else{
		return JSON.parse(uiSettings.value);
	}
}
function updateSettings(val){
	localStorage.plivosettings= val;
	console.log('plivosettings updated!')
}
function customAlert(alertType,alertMessage){
	$(".alertmsg").prepend(
	  '<div class="customAlert">' +
	  '<span style="margin-left:20px;">'+alertType+' | </span>' +
	  '<span style="margin-left:20px;">'+alertMessage+' </span>'+
	  '<span aria-hidden="true" class="closeMetrics" style="margin-left:25px;cursor:pointer;">X</span>' +
	  '</div>'
	);
	$('.closeMetrics').click(function(){
		$('.customAlert').remove();
	});	
}

function updateAudioDevices(){
	// Remove existing options if any
	document.querySelectorAll('#micDev option').forEach(e=>e.remove())
	document.querySelectorAll('#ringtoneDev option').forEach(e=>e.remove())

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

function checkBrowserComplaince(client){
	if(client.browserDetails.browser != "chrome"){
		document.querySelector('[data-target="#popAudioDevices"]').remove();
	}
}

function trimSpace(e){
	 e.value = e.value.replace(/[- ()]/g,'');
}

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
		customAlert('info','Muted');
	}else{
		plivoWebSdk.client.unmute();
		e.currentTarget.setAttribute('data-toggle','mute');
		$('.tmute').attr('class', 'fa tmute fa-microphone')
		customAlert('info','UnMuted');
	}
});
$('#makecall').click(function(e){
	var to = $('#toNumber').val().replace(" ",""), 
		extraHeaders;
	// Prevent click on makecall disabled button	
	var callEnabled = $('#makecall').attr('class').match('disabled');
	if(!to || !plivoWebSdk || !!callEnabled){return};
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

$('#updateSettings').click(function(e){
	var appSettings = document.querySelector('#appSettings'); 
	appSettings = appSettings.value;
	updateSettings(appSettings);
});

$('#resetSettings').click(function(e){
	resetSettings('clickTrigger');
});

$('#qualityRange').click(function(e){
	var value = e.currentTarget.value;
	$('#qualityNumber').html('Rating: '+value);
	// Show quality issue reasons only if rating is less then 4
	if(value < 4){
		$('.lowQualityRadios').show();
	}else{
		$('.lowQualityRadios').hide();
	}
});

$('#sendFeedback').click(function(){
	var score = $('#qualityRange').val();
	var lastCallid = plivoWebSdk.client.getLastCallUUID();
	var comment = $("input[type=radio][name=callqualityradio]:checked").val() || "good";
	score = Number(score);
	plivoWebSdk.client.sendQualityFeedback(lastCallid,score,comment);
	customAlert('Quality feedback','success');
});

$('#clickLogin').click(function(e){
	var userName = $('#loginUser').val();
	var password = $('#loginPwd').val();
	login(userName, password);
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
	document.querySelectorAll('#popAudioDevices option').forEach(e=>e.remove());
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

loginUser.onblur = function(){
	trimSpace(loginUser);
}

showPass.onclick = function(){
	if($('#showPass input').prop("checked")){
		loginPwd.type="text";
	}else{
		loginPwd.type="password";
	}
}
// variables to declare 

var plivoWebSdk; // this will be retrived from settings in UI

function initPhone(username, password){
	var options = refreshSettings();
	plivoWebSdk = new window.Plivo(options);
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
	plivoWebSdk.client.setRingTone(true);
	plivoWebSdk.client.setRingToneBack(true);
	/** Handle browser issues
	* Sound devices won't work in firefox
	*/
	checkBrowserComplaince(plivoWebSdk.client);	
	updateAudioDevices();
	console.log('initPhone ready!')
}

function PlivoJsReady(){
	if(document.readyState == "complete"){
		console.log( "PlivoJs ready!" );
		$('[data-toggle="tooltip"]').tooltip();
		resetSettings();
		initPhone();		
	}
}