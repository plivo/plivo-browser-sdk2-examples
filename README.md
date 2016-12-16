Plivo Web SDK Examples
======================

We'll be adding all our Web SDK examples and demos here. 

Web-Phone Example
-----------------

This is a very simple demo showing how you can make phone calls from the web browser to both sip addresses and PSTN phone numbers
There is a [live web phone demo](http://s3.amazonaws.com/plivowebrtc/phone.html) The entire source code is available in [phone/phone.html](https://github.com/cachrisman/plivo-web-sdk-example/blob/patch-1/phone/phone.html). To use the live demo, please sign up for a Plivo account here: https://manage.plivo.com/accounts/register/ then make a Plivo Endpoint here: https://manage.plivo.com/endpoint/create/. You must use a Plivo Endpoint to log into the WebSDK demo page. Do not try to use your Plivo account credentials to log into the demo.

### Where it all begins
In the document's ready function is where the Plivo JS Objects is initialised

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
      callStatsIo: {
        appId: '1x8xxxxx2',
        appSecret: 's/xxxxxxcxxxuAGv:xxxxxxabcd'
      }
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

### Registering
The UI starts off with a basic login screen for accepting your Plivo Endpoint Credentials. To use the entered values to log in, use the following code

    function login() {
    $('#status_txt').text('');
    plivoWebSdk.client.login($("#username").val(), $("#password").val());
    }

The onLogin listener function, which was registered at the start is then invoked when Plivo sends back the onLogin event

    function onLogin() {
    $('#status_txt').text('Logged in');
    $('#login_box').hide();
    $('#logout_box').show();
    $('#callcontainer').show();
    }

### Making a call
Enter the number or sip uri in the post login UI and click the call button. This action causes the following code to run

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

### Handling Incoming calls
By creating the onIncomingCall listener, the Plivo JS object can handle calls coming into the Plivo Endpoint. 

    function onIncomingCall(account_name, extraHeaders) {
            console.log("onIncomingCall:"+account_name);
            console.log("extraHeaders=");
            for (var key in extraHeaders) {
                console.log("key="+key+".val="+extraHeaders[key]);
            }
            IncomingCallUI();
      }

The UI which shows an incoming call is rendered with the above code. The two actions that can be performed now are answer or reject. The code for answering looks like this.

    function answer() {
    console.log("answering")
    $('#status_txt').text('Answering....');
    plivoWebSdk.client.answer();
    callAnsweredUI()
    }

The reject code looks like this

    function reject() {
    callUI();
    plivoWebSdk.client.reject();
    }

### Terminating a call
This code may be used to terminate a call. 

    function hangup() {
    $('#status_txt').text('Hanging up..');
    plivoWebSdk.client.hangup();
    callUI()
    }

