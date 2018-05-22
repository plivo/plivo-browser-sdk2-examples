function audioVisualize(canvasId) {
    var canvasId = canvasId || null;
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var canvas, context, reqFrame, inputPoint, analyserNode, source, fFrequencyData, barX, barWidth, barHeight, red, green, blue, ctx;
    var start = function(stream, eleId) {
        if(!stream) return;
        var Id = eleId || canvasId;
        canvas = document.getElementById(Id);
        context? context.resume() : (context = new AudioContext());
        inputPoint = context.createGain();
        source = context.createMediaStreamSource(stream);
        source.connect(inputPoint);

        analyserNode = context.createAnalyser();
        analyserNode.fftsize = 2048;
        inputPoint.connect(analyserNode);
        ctx = canvas.getContext('2d');
        drawFrames(); 
    }
    function drawFrames() {
        var k = 0; //keep track of total number of frames drawn
        reqFrame = window.requestAnimationFrame(drawFrames);
        fFrequencyData = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(fFrequencyData);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        numBarsBars = 16;
        //calculate average frequency for color
        var total = 0;
        
        for(var j = 0; j < fFrequencyData.length; j++) {
            total += fFrequencyData[j];
        }
        
        var avg = total / fFrequencyData.length;
        avg = avg / 1.2;
        //bar style visual representation
        function drawBars(numBars) {
            for(var i = 0; i < numBars; i++) {
                barX = i * (canvas.width / numBars);
                barWidth = (canvas.width / numBars - 1);
                barHeight = -(fFrequencyData[i] / 2);
                //reduce frequency of color changing to avoid flickering
                if(k % 15 === 0) {
                    getColors();
                    k = 0;
                }
                ctx.fillStyle = 'rgb('+red+','+green+','+blue+')';
                ctx.fillRect(barX, canvas.height, barWidth, barHeight);
            }
        }
        function getColors() {
            //can edit these values to get overall different coloration!!
            red     = Math.round(Math.sin(avg/29.0 + 6.1) * 127 + 128);
            green   = Math.round(Math.sin(avg/42.0 - 7.4) * 127 + 128);
            blue    = Math.round(Math.sin(avg/34.0 - 3.8) * 127 + 128);
        }
        drawBars(100);
        k++;        
    }    
    return {
        start : start,
        stop : function(){
            context? context.suspend() : null;
            reqFrame? window.cancelAnimationFrame(reqFrame) : null; 
        }
    }
}