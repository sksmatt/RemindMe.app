// prevent app zooming
require('electron').webFrame.setZoomLevelLimits(1, 1);

// require json storage
const storage = require('electron-json-storage'),
	  dateFormat = require('dateformat'),
	  TABLE = "alarms";

(function(window, undefined) {

	'use strict';

	var DueApp = (function() {

		// define / cache
		let index = 0;
		const CHECKEVERY = 60000 / 4,
			form = document.getElementById('due'),
			timeInput = document.getElementById('due__time'),
			alarms = document.getElementById('alarms'),
			alarmsHistory = document.getElementById('alarms__history'),
			tabs = document.querySelectorAll('.tab'),
			panels = document.querySelectorAll('.panel'),
			alarmAudio = document.getElementById('alarm__audio'),
			alarmTPL = `<li class="alarm__entry" data-index="{index}" data-fulldate="{fulldate}">
							<div class="alarm__details">
						   		<div class="alarm__details__desc">{details}</div>
					   			<div class="alarm__details__date">{date} {time}</div> 
					   		</div>
						   <a href="#" class="alarm__delete">Remove</a>
					   </li>`;
		// init
		function init() {
			// load entries
			loadDB(entriesLoadedCallback);
			// bind form specific events
			bindFormEvents();
			// bind alarms/history tabs
			bindTabs();
			// run checker
			tickTack();
		}

		// hook events
		function bindFormEvents() {
			if(form.addEventListener){
				
				// check form submission
				form.addEventListener("submit", function(e) {
					e.preventDefault();
					handleNewEntry();
				}, false);

				// check Enter keydown
				timeInput.addEventListener('keydown', function(e) {
					if(e.which === 13) {
						e.preventDefault();
						handleNewEntry();
					}
				});

				// check input click
				timeInput.addEventListener("click", function(){
					this.focus();
					this.select();
				}, false);
			}
		}

		// bind tabs
		function bindTabs() {
			Array.from(tabs).forEach(tab=>tab.addEventListener("click", function(e){
				e.preventDefault();
				if(!hasClass(this, 'tab--current')) {
					activatePanel(this);
				}
			}, false));
		}

		// activate panel
		function activatePanel(element) {
			let target, panel;
			target = element.getAttribute('data-panel');
			Array.from(tabs).forEach(tab=>tab.classList.remove('tab--current'));
			element.classList.add('tab--current');
			Array.from(panels).forEach(panel=>panel.classList.remove('panel--current'));
			panel = document.getElementById('panel__' + target);
			panel.classList.add('panel--current');
		}		

		// tickTack
		function tickTack() {
			let currentFullDate, matchingAlarm;
			currentFullDate = getCurrentFullDate();
			matchingAlarm = alarms.querySelector("[data-fulldate='"+currentFullDate+"']");
			if(matchingAlarm) {
				alarmHandler(matchingAlarm, currentFullDate);
			}
			setTimeout(tickTack, CHECKEVERY);
		}

		// handle alarm 
		function alarmHandler(entry, currentTime) {
			let reminderDetails = entry.querySelector('.alarm__details__desc').textContent.trim();

			new Notification('DueApp', {
			    title: "Reminder",
			    body: reminderDetails
			});

			alarmAudio.play();
			entry.remove();

			if(alarmsHistory.lastChild) {
				alarmsHistory.insertBefore(entry, alarmsHistory.firstChild);
			} else {
				alarmsHistory.appendChild(entry);
			}
		}

		// load and process entries
		function entriesLoadedCallback(stored) {
			let i;
			if(stored) {
				for (i = 0; i < stored.length; i++) {
					processEntry(stored[i]);
				}
				sortEntries();
			}
		}

		// process new entry
		function handleNewEntry() {
			let entryData = getFormData();
			if(entryData) {
				processEntry(entryData);
				sortEntries();
				saveEntry(entryData);				
			}
			timeInput.value = "";
			timeInput.focus();
		}

		// process entry
		function processEntry(entryData) {
			let entry = processTPL(entryData);
			if(entryData.fulldate <= getCurrentFullDate()) {
				insertHistory(entry);
			} else {
				insertEntry(entry);
			}
		}

		// process template
		function processTPL(entryData) {
			let entryTPL = alarmTPL;
			return entryTPL.replace('{index}', index)
				.replace('{fulldate}', entryData.fulldate)
				.replace('{details}',  entryData.desc)
				.replace('{date}', entryData.date)
				.replace('{time}', entryData.time);
		}

		// insert entry
		function insertEntry(entry) {
			alarms.insertAdjacentHTML('beforeEnd', entry);
			alarms.lastChild.querySelector('.alarm__delete').addEventListener('click', removeHandler, false);
			index++;
		}

		// sort entries
		function sortEntries() {
		  Array.prototype.slice.call(document.querySelectorAll('.alarms__list li')).sort(function(a, b) {
		    return a.getAttribute('data-fulldate').localeCompare(b.getAttribute('data-fulldate'));
		  }).forEach(function(currValue) {
		    currValue.parentNode.appendChild(currValue);
		  });
		}

		// insert history
		function insertHistory(entry) {
			alarmsHistory.insertAdjacentHTML('afterbegin', entry);
			alarmsHistory.firstChild.querySelector('.alarm__delete').addEventListener('click', removeHandler, false);
			index++;
		}

		// remove handler
		function removeHandler(e) {
			e.preventDefault();
			let entry = this.parentNode;
			let id = entry.getAttribute('data-index');
			loadDB(removeHandlerCallback, id, entry);
		}

		// remove promise
		function removeHandlerCallback(stored, id, that) {
			stored.splice(id, 1);
			updateDB(stored);
			that.remove();
		}


		/*
		|--------------------------------------------------------------------------
		| GETTERS
		|--------------------------------------------------------------------------
		*/


		// get form data
		function getFormData() {
			let inputData = timeInput.value;
			if(!inputData) return false;
			let date = new Date(chrono.parseDate(inputData));
			return {
				desc: inputData,
				date: dateFormat(date, "mmm d"),
				time: dateFormat(date, "HH:MM"),
				fulldate: dateFormat(date, "yyyymmddHHMM")
			}
		}

		// get current time formatted
		function getCurrentFullDate() {
			return dateFormat(Date.now(), "yyyymmddHHMM")
		}

		/*
		|--------------------------------------------------------------------------
		| MUTATORS
		|--------------------------------------------------------------------------
		*/

		// replace all
		function replaceAll(str, find, replace) {
		  return str.replace(new RegExp(find, 'g'), replace);
		}

		/*
		|--------------------------------------------------------------------------
		| CHECKERS
		|--------------------------------------------------------------------------
		*/

		// has class
		function hasClass(element, cls) {
			return (element.className.indexOf(cls) != -1);
		}

		/*
		|--------------------------------------------------------------------------
		| DATABASE
		|--------------------------------------------------------------------------
		*/

		// load DB data
		function loadDB(callback) {
			let args, stored;
			args = Array.prototype.slice.call(arguments, 1);
			storage.get(TABLE, function(error, data) {
				if(data.length > 0) {
					stored = JSON.parse(data);	
				} else {
					stored = [];
				}
				if(args.length) {
					args.unshift(stored);
					callback.apply(null, args);
				} else {
					callback(stored);
				}
			});
		}

		// write to db
		function updateDB(data) {
			storage.set(TABLE, JSON.stringify(data));
		}

		// save entry
		function saveEntry(entry) {
			loadDB(saveEntriesCallback, entry);
		}

		// save entry promise
		function saveEntriesCallback(stored, entry) {
			updateDB(stored.concat([entry]));
		}

		// public methods
		return {
		    init: init,
		};

	})();

	// init
	window.DA = DueApp.init();

})(window);