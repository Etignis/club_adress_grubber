'use strict';

const fs = require('fs');
//const argv = require('yargs').argv;
//const cheerio = require('cheerio');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const path = require('path');
//const showdown  = require('showdown');
//const request = require('request');
//const fetch = require('node-fetch');
const axios = require('axios');

const sStartPath = __dirname;
//const cp = require('child_process');

//const oPath = "D:/rpg_download";


function get_vk_links(){	
	let filePath = path.join(sStartPath,'links.txt');
	let oFile = fs.readFileSync(filePath, {encoding : 'utf8'});
	let aVkLinks = oFile.match(/https?:\/\/vk.com\/[a-z0-9_-]+/g);
	return aVkLinks;
}

async function get_vk_group_data(sGroupURL){
	return new Promise((resolve, reject)=>{
		axios.get(sGroupURL)
		.then(function (response) {
			// handle success
			//console.log(response);
			let sHtml = response;
			//console.log('sHtml', sHtml);
			//const $ = cheerio.load(sHtml.data);
			const dom = new JSDOM(sHtml.data);
			let aInfo = [];
			//console.log(dom.window.document.querySelector(".page_description").textContent);
			
			dom.window.document.querySelectorAll('.pinfo_row').forEach(sRaw=>{
				// if(/<dt>Описание:</dt>/.test(sRaw)) {
					// описание 
					
				// }
				
				aInfo.push(sRaw.textContent);
			});
			
			// const sInfo = dom.window.document.querySelector('.page_description').text();
			// const sAdress = dom.window.document.querySelector('.address').text();
			// const sSite = dom.window.document.querySelector('.site').text();
			
			// const oData = {
				// info: sInfo,
				// adress: sAdress,
				// site: sSite
			// };
			
			//console.dir(aInfo);
			let sClubInfo = aInfo.join('\r\n');
			let oClubInfo = {
				url: sGroupURL,
				data: sClubInfo
			}
			setTimeout(function(){resolve(oClubInfo)}, 500)
			//resolve(aInfo);
		})
		.catch(function (error) {
			// handle error
			console.log(error);
			resolve(null);
		})
		
    .catch(err => {console.error(err); reject(err)});
	});
	
}

async function get_vk_data(aLinks){
	let aData = [];
	for (let i=0; i<aLinks.length; i++) {
		const oGroupData = await get_vk_group_data(aLinks[i]);
		if(oGroupData) {
			aData.push(oGroupData);
		}
	}
	
	return aData;
}

function write_output(aData){
	let filePath = path.join(sStartPath,'vk_data.txt');
	let sFileData =  aData.map(oClubData=> `${oClubData.url}: \r\n ${oClubData.data}`).join('\r\n\r\n------\r\n\r\n')
	fs.writeFileSync(filePath, sFileData);
}

async function  main() {
  let aVkLinks = get_vk_links();
	let aVkData = await get_vk_data(aVkLinks);
	//console.dir (aVkData);
	write_output(aVkData);
}

main();