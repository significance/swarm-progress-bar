let gatewayHost = 'http://localhost:8080'

class SwarmProgressBar {
	constructor(gateway){
		this.gateway = gateway;
		this.uploadProgressPercent = 0;

		this.onProgressCallback = false;
		this.onErrorCallback = false;
		this.onStartCallback = false;

		this.status = {
			Total: false,
			Received: false,
			Complete: false,
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

		let url = this.gateway+'/files';

		return this.sendUploadRequest(url, 'POST', 'application/json', formData, formData.get('file').size).then((swarmHash) => {
			this.setStatus({swarmHash: swarmHash});  
			this.setStatus({gatewayLink: url + "/" + swarmHash});
			this.onUploadedCallback(swarmHash);
		}).catch((error) => {
			throw new Error(error);
		});
	}

	sendUploadRequest(url, requestType, responseType = 'text', data, dataLength) {
		this.setStatus({Total: dataLength});

		return new Promise((resolve,reject) => {

			let xhr = new XMLHttpRequest();

			xhr.onloadstart = () => {
				if(this.onStartCallback){
					this.onStartCallback(event);
				}
			};

			xhr.onreadystatechange = function(){   
				if(xhr.readyState === 4 && xhr.status === 200){
					resolve(xhr.response.reference);
				}
			}

			xhr.upload.onprogress = this.onProgressCallback;

			xhr.onerror = (error) => {
				console.log(error)
				reject(error);
			};

			xhr.open('POST', url, true);
			xhr.responseType = 'json';
			
			xhr.send(data);

		});

	}

	sendRequest(url, requestType, responseType = 'text', data, dataLength) {
		return new Promise((resolve,reject) => {
			let xhr = new XMLHttpRequest();

			xhr.onreadystatechange = function(){ 
				if(xhr.readyState === 4 && xhr.status === 200){
					resolve(xhr);  
				}
			}

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

	cancel(){
		clearInterval(this.checkProgressInterval);
	}

}

let humanFileSize = (size) => {
	var i = Math.floor( Math.log(size)/Math.log(1024) );
	return ( size/Math.pow(1024, i) ).toFixed(0) * 1 + ' ' + ['bytes', 'kb', 'mb', 'gb', 'tb'][i];
};


let fadeAndReplace = (selector, content, time=0) => {
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

let fadeInComponent = (headerSelectorIn, selectorIn, time=100) => {
	let elementIn = document.querySelector(selectorIn);
	let headerIn = document.querySelector(headerSelectorIn);

	if(headerSelectorIn){
		headerIn.classList.add("active");
	}

	for (var i = components.length - 1; i >= 0; i--) {
		if(components[i][1] !== selectorIn){
			if(headerSelectorIn){
				document.querySelector(components[i][0]).classList.remove("active");
			}
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
		},0);
	}, time);
};


let goToPage = () => {
  var page = document.getElementById('downloadHashField').value;
  if (page == "") {
	return false;
  }
  var address = gatewayHost + "/files/" + page;
  location.href = address;
}

let copyHashAction = (e) => {
	e.preventDefault();

	let copyText = document.querySelector('#uploadHashInput');
	copyText.select();
	copyText.setSelectionRange(0, 99999); /*For mobile devices*/
	document.execCommand("copy");
	alert("Copied Swarm hash to clipboard!"); 
};


let copyLinkAction = (e) => {
	e.preventDefault();

	let copyText = document.querySelector('#uploadLinkInput');
	copyText.select();
	copyText.setSelectionRange(0, 99999); /*For mobile devices*/
	document.execCommand("copy");
	alert("Copied link to clipboard!"); 
};

let isUploading = false;
let currentProgressBar = null;

document.addEventListener('DOMContentLoaded', function(){ 
	let form = document.querySelector('#uploadForm');
	let uploadComponent = document.querySelector('#uploadComponent');
	let uploadFeedbackComponent = document.querySelector('#uploadFeedbackComponent');

	let resetUpload = () => {
		document.querySelector('#uploadSelectFile').value = "";
		document.querySelector('#uploadSelectedFile').value = "";
		document.querySelector('#uploadSwarmhash').innerHTML = "Waiting for hash...";
		document.querySelector('#uploadHashInput').classList.remove('hidden');
		document.querySelector('#uploadButtonHash').classList.add('fadeOut');
		document.querySelector('#uploadButtonLink').classList.add('fadeOut');

		document.querySelector('#uploadComponent .controlComponentMessage').innerHTML = "Select your file to upload it to the Swarm network.";
		isUploading = false;
		if(currentProgressBar !== null){
			currentProgressBar.cancel();			
		}
	}

	form.addEventListener("submit", (e)=>{
		e.preventDefault();

		if(currentProgressBar){
			currentProgressBar.cancel();
		}

		if(document.querySelector('#uploadSelectFile').value === ""){
			return false;
		}

		if(isUploading === true){
			return false;
		}

		isUploading = true;

		let formData = new FormData(form);

		document.querySelector('#uploadFilename').innerHTML = truncateEnd(formData.get('file').name, 45);

		if(formData.get('file')){
			swb = new SwarmProgressBar(gatewayHost);
			currentProgressBar = swb;
			swb.onProgress((st)=>{
				let received = Math.floor(st.loaded / swb.status.Total)*100;
				swb.setStatus({Received: received});

				document.querySelector('#uploadReceivedCount').innerHTML = swb.status.Received !== false ? padNumber(swb.status.Received, 3) + "%" : "";

				document.querySelector('#uploadReceivedBar').setAttribute('style', swb.status.Received !== false ? "width: "+ swb.status.Received + "%" : "");
			});
			swb.onStart((event)=>{
				fadeInComponent(false, '#uploadFeedbackComponent')
			})
			swb.onError((event)=>{
				console.log('error', event);
			})
			swb.onUploaded((response)=>{
				document.querySelector('#uploadStatusMessage').innerHTML = "Uploaded";
				fadeAndReplace(
					'#uploadSwarmhash', 
					swb.status.swarmHash !== false ? swb.status.swarmHash : ""
				);
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
				"Upload '" + truncateEnd(e.target.files[0].name,50) + "' (" + humanFileSize(e.target.files[0].size) +") ?"
				);
			uploadSelectedFile.value = truncateEnd(e.target.files[0].name, 96);
		}else{
			uploadSelectedFile.value = "";
		}
	}, false);

	document.querySelector('#uploadButtonLink').addEventListener('click', copyLinkAction)   ; 

	document.querySelector('#uploadButtonHash').addEventListener('click', copyHashAction);

	document.querySelector('#controlHeaderDownload').addEventListener('click', (e) => {
		fadeInComponent('#controlHeaderDownload', '#downloadComponent')
	});


	document.querySelector('#controlHeaderUpload').addEventListener('click', (e) => {
		resetUpload();
		fadeInComponent('#controlHeaderUpload', '#uploadComponent'); 
	});

	document.querySelector('#uploadCancelButton').addEventListener('click', (e) => {
		resetUpload();
		fadeInComponent('#controlHeaderUpload', '#uploadComponent'); 
	});

	document.querySelector('#downloadForm button').addEventListener('click', (e) => {
		e.preventDefault();
		goToPage();
	});

}, false);

