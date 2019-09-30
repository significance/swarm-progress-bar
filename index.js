class SwarmProgressBar {
	constructor(gateway){
		this.gateway = gateway;
		this.uploadProgressPercent = 0;
		this.tagId = false;
		this.pollEvery = 1 * 1000;
		this.checkInterval = false;
		this.onProgressCallback = false;
        this.onErrorCallback = false;
        this.onStartCallback = false;

		this.status = {
			Total: false,
			Received: false,
			Seen: false,
			Sent: false,
			Split: false,
			Stored: false,
			Synced: false,
            Complete: true,
            swarmHash: false,
            gatewayLink: false
		};

		this.isComplete = false;
	}

    setStatus(newStatus){
        for(var key in newStatus) { 
            this.status[key] = newStatus[key];
        }
    }

    upload(formData) {
        this.startCheckProgress();

        let url = this.gateway + '/bzz:/';

        return this.sendRequest(url, 'POST', 'text', formData, formData.get('file').size).then((response) => {
            let swarmHash = response.responseText;
            this.setStatus({swarmHash: swarmHash});      
            this.setStatus({gatewayLink: url + swarmHash + "/" + formData.get('file').name});
        	this.tagId = response.getResponseHeader('x-swarm-tag');
            this.onUploadedCallback(response);
        }).catch((error) => {
            throw new Error(error);
        });
    }

    startCheckProgress(){
    	this.checkProgressInterval = setInterval(()=>{
    		this.checkProgress();
    	}, this.pollEvery);
    	this.checkProgress();
    }

    checkProgress(){
        let responseData;
        if(this.tagId !== false){
            let url = this.gateway + '/bzz-tag:/?Id=' + this.tagId;
            return this.sendRequest(url, 'GET', 'json').then((response) => {
                if(response.responseText){
                    responseData = JSON.parse(response.responseText);
                    this.setStatus({
                        Total: responseData.Total,
                        Seen: responseData.Seen,
                        Sent: responseData.Sent,
                        Split: responseData.Split,
                        Stored: responseData.Stored,
                        Synced: responseData.Synced
                    });
                }
                if(this.onProgressCallback){
                    this.onProgressCallback(this.status);
                }
                if(responseData.Total === responseData.Seen - responseData.Sent){
                    this.isCompleted = true;
                    clearInterval(this.checkProgressInterval);
                }
            }).catch((error) => {
                this.isErrored = true;
                clearInterval(this.checkProgressInterval);
                throw new Error(error);
            });
        }else{
            if(this.onProgressCallback){
                this.isErrored = true;
                this.onProgressCallback(this.status);
            }
        }
    }

    sendRequest(url, requestType, responseType = 'text', data, dataLength) {
        return new Promise((resolve,reject) => {
            let xhr = new XMLHttpRequest();

            xhr.onloadstart = () => {
                if(this.onStartCallback){
                    this.onStartCallback(event);
                }
            };

            xhr.onreadystatechange = function(){
                if(xhr.readyState === 4 && xhr.status === 200){
                    if(this.onStartCallback){
                        this.onStartCallback(event);
                    }                
                }                
                if(xhr.readyState === 4 && xhr.status === 200){
                    resolve(xhr);              
                }
            }

            xhr.upload.onprogress = (event) => {
                console.log('e', event.loaded, dataLength)
                let received;
                if(event.loaded > dataLength){
                    received = 100;
                }else{
                    received = Math.floor((event.loaded / dataLength) * 100, 2);
                }
                this.setStatus({Received: received});
            };

            xhr.onerror = (error) => {
                reject(error);
            };

            xhr.open(requestType, url, true);

            xhr.setRequestHeader('Accept', responseType);

            xhr.send(data);
        });

    }

    onProgress(fn){
    	this.onProgressCallback = fn;
    }

    onStart(fn){
        this.onStartCallback = fn;
    }    

    onError(fn){
        this.onErrorCallback = fn;
    }   

    onUploaded(fn){
        this.onUploadedCallback = fn;
    }

}

let humanFileSize = (size) => {
    var i = Math.floor( Math.log(size) / Math.log(1024) );
    return ( size / Math.pow(1024, i) ).toFixed(0) * 1 + ' ' + ['bytes', 'kb', 'mb', 'gb', 'tb'][i];
};


let fadeAndReplace = (selector, content, time=600) => {
    let element = document.querySelector(selector);    
    element.classList.add("fades");
    element.classList.add("fadeOut");
    setTimeout(()=>{
        element.innerHTML = content;
        element.classList.remove("fadeOut");        
    }, time);
};

let padNumber = (n, width, z) => {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}


let truncateEnd = function (string, length, separator = '...') {
    if (string.length <= length) return string;
    return string.substr(0, length) + separator;
};

let components = [
    ['#controlHeaderDownload','#downloadComponent'],
    ['#controlHeaderUpload','#uploadComponent'],
    ['#controlHeaderInfo','#uploadFeedbackComponent']
];

let fadeInComponent = (headerSelectorIn, selectorIn, time=600) => {
    let elementIn = document.querySelector(selectorIn);    
    let headerIn = document.querySelector(headerSelectorIn);    

    headerIn.classList.add("active");        

    for (var i = components.length - 1; i >= 0; i--) {
        if(components[i][1] !== selectorIn){
            document.querySelector(components[i][0]).classList.remove("active");
            document.querySelector(components[i][1]).classList.add("fadeOut");
        }
    }

    setTimeout(()=>{
        for (var i = components.length - 1; i >= 0; i--) {
            if(components[i][1] !== selectorIn){  
                document.querySelector(components[i][1]).classList.add("hidden");
            }
        }


        elementIn.classList.add("fadeOut");     
        elementIn.classList.remove("hidden");            
        setTimeout(()=>{   
            elementIn.classList.remove("fadeOut");
        },200);
    }, time);
};


let goToPage = () => {
  var page = document.getElementById('downloadHashField').value;
  if (page == "") {
    var page = "theswarm.eth"
  }
  var address = "/bzz:/" + page;
  location.href = address;
}

document.addEventListener('DOMContentLoaded', function(){ 
    let form = document.querySelector('#uploadForm');
    let uploadComponent = document.querySelector('#uploadComponent');
    let uploadFeedbackComponent = document.querySelector('#uploadFeedbackComponent');
    form.addEventListener("submit", (e)=>{
        e.preventDefault();
        let formData = new FormData(form);

        document.querySelector('#uploadFilename').innerHTML = truncateEnd(formData.get('file').name, 25);

        if(formData.get('file')){
            let swb = new SwarmProgressBar('http://localhost:8500');
            swb.onProgress((status)=>{
                let totalLength = status.Total.toString().length;
                document.querySelector('#uploadReceivedCount').innerHTML = status.Received !== false ? `${padNumber(status.Received, 3)} / 100 %` : "";
                document.querySelector('#uploadSentCount').innerHTML = status.Sent !== false ? `${padNumber(status.Sent, totalLength)} / ${status.Total}` : "";
                document.querySelector('#uploadSplitCount').innerHTML = status.Split !== false ? `${padNumber(status.Split, totalLength)} / ${status.Total}` : "";
                document.querySelector('#uploadSeenCount').innerHTML = status.Seen !== false ? `${padNumber(status.Seen, totalLength)} / ${status.Total}` : "";
                document.querySelector('#uploadStoredCount').innerHTML = status.Stored !== false ? `${padNumber(status.Stored, totalLength)} / ${status.Total}` : "";

                document.querySelector('#uploadReceivedBar').setAttribute('style', status.Received !== false ? `width: ${status.Received}%` : "");
                document.querySelector('#uploadSentBar').setAttribute('style', status.Sent !== false ? `width: ${Math.floor((status.Sent / status.Total) * 100, 2)}%` : "");
                document.querySelector('#uploadSplitBar').setAttribute('style', status.Split !== false ? `width: ${Math.floor((status.Split / status.Total) * 100, 2)}%` : "");
                document.querySelector('#uploadSeenBar').setAttribute('style', status.Seen !== false ? `width: ${Math.floor((status.Seen / status.Total) * 100, 2)}%` : "");
                document.querySelector('#uploadStoredBar').setAttribute('style', status.Stored !== false ? `width: ${Math.floor((status.Stored / status.Total) * 100, 2)}%` : "");

            });
            swb.onStart((event)=>{
                fadeInComponent('#controlHeaderInfo', '#uploadFeedbackComponent')
            })
            swb.onError((event)=>{
                console.log('error',event);
            })
            swb.onUploaded((response)=>{
                document.querySelector('#uploadStatusMessage').innerHTML = "Uploaded";                    
                document.querySelector('#uploadSwarmhash').innerHTML = swb.status.swarmHash !== false ? `to <em>${truncateEnd(swb.status.swarmHash, 14)}</em>` : "";    
                document.querySelector('#uploadButtonLink').classList.remove("fadeOut");
                document.querySelector('#uploadLinkInput').value = swb.status.gatewayLink;
                document.querySelector('#uploadButtonHash').classList.remove("fadeOut");                
                document.querySelector('#uploadHashInput').value = swb.status.swarmHash;
            })
            swb.upload(formData);
        }
    }, false);

    let uploadSelectFile = document.querySelector('#uploadSelectFile');
    let uploadSelectedFile = document.querySelector('#uploadSelectedFile');
    form.addEventListener("change", (e)=>{
        e.preventDefault();
        if(e.target.files.length > 0){
            fadeAndReplace(
                '#uploadComponent .controlComponentMessage', 
                `Upload '${truncateEnd(e.target.files[0].name,50)}' (${humanFileSize(e.target.files[0].size)})?`
                );
            uploadSelectedFile.value = truncateEnd(e.target.files[0].name, 96);
        }else{
            uploadSelectedFile.value = "";
        }
    }, false);

    document.querySelector('#uploadButtonLink').addEventListener('click', (e) => {
        e.preventDefault();

        let copyText = document.querySelector('#uploadLinkInput');
        copyText.select();
        copyText.setSelectionRange(0, 99999); /*For mobile devices*/
        // setTimeout(()=>{
            document.execCommand("copy");
            alert("Copied link to clipboard!");             
        // },500);
    })    

    document.querySelector('#uploadButtonHash').addEventListener('click', (e) => {
        e.preventDefault();

        let copyText = document.querySelector('#uploadHashInput');
        copyText.select();
        copyText.setSelectionRange(0, 99999); /*For mobile devices*/
        // setTimeout(()=>{
            document.execCommand("copy");
            alert("Copied hash to clipboard!"); 
        // },500);
    });

    document.querySelector('#controlHeaderDownload').addEventListener('click', (e) => {
        fadeInComponent('#controlHeaderDownload', '#downloadComponent')        
    });


    document.querySelector('#controlHeaderUpload').addEventListener('click', (e) => {
        document.querySelector('#uploadSelectFile').value = "";
        document.querySelector('#uploadSelectedFile').value = "";
        document.querySelector('#uploadComponent .controlComponentMessage').innerHTML = "Select your file to upload it to the Swarm network.";
        fadeInComponent('#controlHeaderUpload', '#uploadComponent');     
    });    

    document.querySelector('#uploadCancelButton').addEventListener('click', (e) => {
        document.querySelector('#uploadSelectFile').value = "";
        document.querySelector('#uploadSelectedFile').value = "";
        document.querySelector('#uploadComponent .controlComponentMessage').innerHTML = "Select your file to upload it to the Swarm network.";
        fadeInComponent('#controlHeaderUpload', '#uploadComponent');     
    });

    document.querySelector('#downloadForm button').addEventListener('click', (e) => {
        goToPage();
    });



    // let uploadSelectField = document.querySelector('#uploadSelectField');
    // form.addEventListener("click", (e)=>{
    //     e.preventDefault();
    //     console.log(this)
    // }, false);
}, false);

