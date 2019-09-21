class SwarmProgressBar {
	constructor(gateway){
		this.gateway = gateway;
		this.uploadProgressPercent = 0;
		this.tagId = false;
		this.pollEvery = 1 * 1000;
		this.checkInterval = false;
		this.onProgressCallback = false;

		this.status = {
			Total: false,
			Uploaded: false,
			Seen: false,
			Sent: false,
			Split: false,
			Stored: false,
			Synced: false
		};

		this.isComplete = false;
	}

    upload(file) {
        this.startCheckProgress();

        let url = this.gateway + '/bzz:/';
        var formData = new FormData();
        formData.append('file', file);
        return this.sendRequest(url, 'POST', 'text', formData, file.size).then((response) => {
        	this.tagId = response.headers['x-swarm-tag'];
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
        if(this.tagId !== false){
            let url = this.gateway + '/bzz-tag:/?Id=' + this.tagId;
            return this.sendRequest(url, 'GET', 'json').then((response) => {
                if(response.data){
                    this.status = {
                        Total: response.data.Total,
                        Seen: response.data.Seen,
                        Sent: response.data.Sent,
                        Split: response.data.Split,
                        Stored: response.data.Stored,
                        Synced: response.data.Synced
                    };
                }
                if(this.onProgressCallback){
                    this.onProgressCallback(this.status);
                }
                if(response.data.Total === response.data.Synced){
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
                console.log(this.status)
                this.onProgressCallback(this.status);
            }
        }
    }

    sendRequest(url, requestType, responseType = 'text', data, dataLength) {
        return axios.request({
            responseType: responseType, 
            url: `${url}`, 
            method: requestType,
            headers: {
                'Accept': responseType,
            },
            data: data,
            onUploadProgress: (event) => {
        		this.status.Uploaded = Math.floor((event.loaded / dataLength) * 100, 2);
            }
        })
    }

    onProgress(fn){
    	this.onProgressCallback = fn;
    }

}

document.addEventListener('DOMContentLoaded', function(){ 
    let form = document.querySelector('#uploadForm');
    form.addEventListener("submit", (e)=>{
        e.preventDefault();
        let input = document.querySelector('#file');
        let feedback = document.querySelector('#uploadFeedback');
        let swb = new SwarmProgressBar('http://localhost:8500');
        swb.onProgress((status)=>{
            feedback.innerHTML = JSON.stringify(status);
        });
        swb.upload(input.files[0]);
    }, false);
}, false);

