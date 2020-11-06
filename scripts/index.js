'use strict';

const fs = require('fs');
//const argv = require('yargs').argv;
//const cheerio = require('cheerio');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const path = require('path');
const dotenv = require('dotenv');
//const showdown  = require('showdown');
//const request = require('request');
//const fetch = require('node-fetch');
const axios = require('axios');


dotenv.config({ path: '_env' });
const { VK_APP_KEY } = process.env;
const vk_api = 'https://api.vk.com/method';
const sStartPath = __dirname;
const sVkGroupsSourcePath = path.join(sStartPath, '../data', 'links.txt');
const sVkGroupsOutputPath = path.join(sStartPath, '../data', 'vk_data.txt');
//const cp = require('child_process');

//const oPath = "D:/rpg_download";


function get_vk_links(){	
	let filePath = sVkGroupsSourcePath;
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

// "грабим" без API 
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


async function _vkAPI(sMethod, oParams){
	let aParams=[
		`access_token=${VK_APP_KEY}`,
		`v=5.124`,
	];
	for (let key in oParams) {
		aParams.push(`${key}=${oParams[key]}`);
	}
	let sApiUrl=`${vk_api}/${sMethod}?${aParams.join('&')}`;
	
	return new Promise((resolve, reject) => {
	axios.get(sApiUrl)
		.then(function (response) {
			if(response && response.data && response.data.response) {				
				resolve(response.data.response);		
			}	else {
				reject({error: 'Не удалось получить данные групп', data: response});
			}
		})
		.catch(function (error) {
			console.log(error);
			reject(error);
		})
		
	})
		
}

async function  get_groups_data_by_api(aLinks){
	let aNames = aLinks.map(el=>el.replace('https://vk.com/', ''));
	let aGroupsData = await _vkAPI('groups.getById', 
		{
			group_ids: aNames.join(),
			fields: [
				'name',
				'deactivated',
				'country',
				'city',
				'place',
				'addresses',
				//'contacts',
				'description'				
			].join()
		}
	);
	
	if(aGroupsData){
		return aGroupsData;
	}
}
async function add_groups_addresses(aGroups){
	for (let i=0; i<aGroups.length; i++) {
		if(aGroups[i].addresses) {
			let aGroupAddress= await _vkAPI('groups.getAddresses', 
				{
					group_id: aGroups[i].id,
					address_ids: aGroups[i].addresses.main_address_id,
					fields: [
						'title',
						'address',
						'city',
						'country',
						'place'
					].join()
				}
			);
			if(aGroupAddress && aGroupAddress.items && aGroupAddress.items[0]) {
				aGroups[i].address = aGroupAddress.items[0].address;
				aGroups[i].addressTitle = aGroupAddress.items[0].title;
			}
		}
		
	}

	return aGroups;
}

function write_output(aData){
	let filePath = sVkGroupsOutputPath;
	let sFileData = JSON.stringify(aData, null, '  ') ;//  aData.map(oClubData=> `${oClubData.url}: \r\n ${oClubData.data}`).join('\r\n\r\n------\r\n\r\n')
	fs.writeFileSync(filePath, sFileData);
}

async function  main() {
  let aVkLinks = get_vk_links();
	//let aVkData = await get_vk_data(aVkLinks);
	let aVkData = await get_groups_data_by_api(aVkLinks);
	aVkData = await add_groups_addresses(aVkData);
	//console.dir (aVkData);
	write_output(aVkData);
}

main();