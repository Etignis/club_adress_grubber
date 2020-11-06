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

const mysql = require('mysql2');
let db_connection;

dotenv.config({ path: '_env' });
const { 
	VK_APP_KEY,
	DB_DRIVER,
	DB_HOST,
	DB_PORT,
	DB_USERNAME,
	DB_PASSWORD,
	DB_NAME
 } = process.env;
const vk_api = 'https://api.vk.com/method';
const sStartPath = __dirname;
const sVkGroupsSourcePath = path.join(sStartPath, '../data', 'links.txt');
const sVkGroupsOutputPath = path.join(sStartPath, '../data', 'vk_data.txt');
//const cp = require('child_process');

//const oPath = "D:/rpg_download";

function start_db_connection(){
	// create the connection to database
	db_connection = mysql.createConnection({
		host: DB_HOST,
		user: DB_USERNAME,
		password: DB_PASSWORD,
		database: DB_NAME
	});
}

function get_from_db(){
	start_db_connection();
	return new Promise((resolve, reject) => {
		connection.query(
		`SELECT 
			id,
			url_site
		FROM 'rpgcrf_clubs'`,
		function(err, results, fields) {
				console.log(results); // results contains rows returned by server
				console.log(fields); // fields contains extra meta data about results, if available
				
				if(err) {
					reject(err);
				} else {
					resolve(results);
				}
			}
		})	
	);
}

function update_db(aData){
	let aQueries = [];
	// из каждого объекта с информациекй о клубе формируем запрос UPDATE
	aData.forEach(el=>{
		let oData = {};
		oData.title = el.name;
		oData.desc = el.description;
		oData.address = el.address;
		oData.address_city = el.city?el.city.title || 'Город неизвестен';
		//oData.date_update = new Date();
		oData.banner_vertical = el.photo_200;
		
		let sQueryPart = `title='${oData.name}', 
		desc=${oData.description}, 
		address=${oData.address}, 
		address_city=${oData.address_city}, 
		banner_vertical=${oData.banner_vertical}`
		
		let sUpdateQuery =`UPDATE 'rpgcrf_clubs'
		SET 
			${sQueryPart}
		WHERE  url_site = 'https://vk.com/${screen_name}'`;
		
		aQueries.push(sUpdateQuery)
	});
	
	return new Promise((resolve, reject) => {
		connection.query(
		aQueries.join(';'), // Объединяем все запросы в один
		function(err, results, fields) {
				console.log(results); // results contains rows returned by server
				console.log(fields); // fields contains extra meta data about results, if available
				
				stop_db_connection();
				
				if(err) {
					reject(err);
				} else {
					resolve(results);
				}
			}
		})	
	);
}

function stop_db_connection(){
	connection.end(function(err) {
		if (err) {
			return console.log("Ошибка: " + err.message);
		}
		console.log("Подключение закрыто");
	});
}


function get_vk_links(){	
	let filePath = sVkGroupsSourcePath;
	let oFile = fs.readFileSync(filePath, {encoding : 'utf8'});
	let aVkLinks = oFile.match(/https?:\/\/vk.com\/[a-z0-9_-]+/g);
	return aVkLinks;
}

// парсинг без API
async function get_vk_group_data(sGroupURL){
	return new Promise((resolve, reject)=>{
		axios.get(sGroupURL)
		.then(function (response) {
			
			const dom = new JSDOM(sHtml.data);
			let aInfo = [];
			
			dom.window.document.querySelectorAll('.pinfo_row').forEach(sRaw=>{
				
				aInfo.push(sRaw.textContent);
			});
			
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

// Формирование запросов к API
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
  // let aVkLinks = get_vk_links(); // из файла
	let aVkLinks = await get_from_db(); // из БД
	let aVkData = await get_groups_data_by_api(aVkLinks);
	aVkData = await add_groups_addresses(aVkData);
	//write_output(aVkData); // в файл
	update_db(aVkData);
}

main();