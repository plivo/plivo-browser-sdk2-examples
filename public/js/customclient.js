
// UI tweaks
$('#makecall').attr('class', 'btn btn-success btn-block flatbtn disabled');

function kickStartNow(){
		$('.callScreen').hide();
		$('.loader').show();
		$('.fadein-effect').fadeIn(5000);	
}
function login(username, password) {
		if(username){
			plivoWebSdk.client.login(username, password);
			$('#sipUserName').html('sip:'+username+'@'+plivoWebSdk.client.phone.configuration.hostport_params);
			document.querySelector('title').innerHTML=username;
		}	
}
function onWebrtcNotSupported() {
	console.warn('no webRTC support');
	alert('No webRTC');
}
function mediaMetrics(obj){
	/** 
	* Set a trigger for Quality Feedback popup when there is an warning druing call using sessionStorage
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
	  '<span aria-hidden="true" onclick="closeMetrics(this)" style="margin-left:25px;cursor:pointer;">X</span>' +
	  '</div>'
	);
	}
	if(!obj.active && classExist){
		document.querySelector('.-'+obj.type).remove();
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
	var timer = 0;
	window.calltimer = setInterval(function(){
		timer = timer +1;
		$('#callDuration').html(timer.calltimer());
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
	callOff();
}
function onMediaPermission(evt){
	console.info('onMediaPermission',evt);
	if(evt.error){
		customAlert('Media permission error',evt.error);
	}
}
function onIncomingCall(callerName, extraHeaders){
	console.info(callerName, extraHeaders);
	$('#boundType').html('Incomming :');
	$('#callNum').html(callerName);
	$('#callDuration').html('00:00:00');
	$('.callinfo').show();
	$('.callScreen').show();
	$('.inboundBeforeAnswer').show();
}
function onIncomingCallCanceled(){
	console.info('onIncomingCallCanceled');
	callOff();
}

function closeMetrics(e){
	e.parentElement.remove();
}

function resetSettings(source){
	// You can use all your default settings to go in as options during sdk init
	var defaultSettings = {"debug":"DEBUG","permOnClick":true,"codecs":["OPUS","PCMU"],"enableIPV6":false,"audioConstraints":{"optional":[{"googAutoGainControl":false}]},"dscp":true,"enableTracking":false,"appId":"1xxxxxxxx0"}
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
		return JSON.parse(getSettings);
	}else{
		return JSON.parse(uiSettings.value);
	}
}
function updateSettings(val){
	localStorage.setItem('plivosettings',val);
	console.log('plivosettings updated!')
}
function customAlert(alertType,alertMessage){
	$(".alertmsg").prepend(
	  '<div class="customAlert">' +
	  '<span style="margin-left:20px;">'+alertType+' | </span>' +
	  '<span style="margin-left:20px;">'+alertMessage+' </span>'+
	  '<span aria-hidden="true" onclick="closeMetrics(this)" style="margin-left:25px;cursor:pointer;">X</span>' +
	  '</div>'
	);
}

function trimSpace(e){
	 e.value = e.value.replace(' ','');
}

function callOff(){
	$('.callScreen').hide();
	$('.inboundBeforeAnswer').hide();
	$('.AfterAnswer').hide();
	$('.outboundBeforeAnswer').hide();
	window.calltimer? clearInterval(window.calltimer) : false;
	setTimeout(function(){
		$('#callstatus').html('Idle');
		$('.callinfo').hide();		
	},3000);
}

Number.prototype.calltimer = function () {
    var sec_num = parseInt(this, 10);
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);
    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}
// UI functions

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
$('#Hangup').click(function(){
	console.info('Hangup');
	if(plivoWebSdk.client.callSession){
		plivoWebSdk.client.hangup();
	}else{
		callOff();
	}
});

/** 
* Hangup calls on page reload / close
* This is will prevent the other end still listening for dead call
*/
window.onbeforeunload = function () {
    plivoWebSdk.client.hangup();
};

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
	var to = $('#toNumber').val().replace(" ","");
	var extraHeaders = {'X-PH-header1': 'test1', 'X-PH-header2': 'test2'};
	var callEnabled = $('#makecall').attr('class').match('disabled');
	if(!to || !plivoWebSdk || !!callEnabled){return};
	plivoWebSdk.client.call(to,extraHeaders);	
	console.info('Click make call : ',to);

	$('.callScreen').show();
	$('.AfterAnswer').show();
	$('#boundType').html('Outgoing :');
	$('#callNum').html(to);
	$('#callDuration').html('00:00:00');
	$('.callinfo').show();
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
	startPhone(userName, password);
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

// variables to declare 

var plivoWebSdk; // this will be retrived from settings in UI

function startPhone(username, password){
		if(!username) return;
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

		//Show screen loader and other UI stuffs
		kickStartNow();
        plivoWebSdk.client.setRingTone(true);
        plivoWebSdk.client.setRingToneBack(true);
        login(username, password);
}