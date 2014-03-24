//init namespace if needed
var nxnw = nxnw || {};

define(function(require){
	var jQuery = require('jquery');
	// first we set up our constructor function
	function fval(args, options){
		//set object options
		this.options = $.extend({}, this.defaults, options);

		//verify a valid form was passed in
		if(!args.hasOwnProperty('el') ||  args.el.length === 0) {
			return;
		}
		//set object properties
		this.$el = args.el;
		this.$msg = args.hasOwnProperty('msg') && args.msg.length !== 0 ? args.msg : false;
		this.input_pattern = Modernizr.input.pattern;
		this.required = Modernizr.input.required;
		//various callbacks..
		this._pre = args.hasOwnProperty('pre') ? args.pre : false;
		this._validation = args.hasOwnProperty('validation') ? args.validation : false;
		this._callback = args.hasOwnProperty('callback') ? args.callback : false;

		//get form inputs for validation
		this.inputs = this._find_inputs(this.$el);
		//fire init function
		this._init();
	} /* \constructor */

	//create prototype
	fval.prototype = {
		defaults: {
			error_class: 'error',
			force_validate: false,
			submit_type: 'submit',
			working_text: false,
			onsubmit_disable: true,
			postvalidate_enable: false,
			test_checkbox: false, /* needs to be an array of names of the checkboxes groups that need to be tested*/
			failed_validation_msg: 'There was an issue with your submission, please recheck the fields and try again.',
			reset_msg: true
		}, /* \defaults */

		//define fval functions below
		_init: function(){
			var self = this;
			//get browser so we can check for Safari since its gives a false positive for required
			var browser_obj = this._browser_sniff();
			this.browser = browser_obj.browser;

			//set element references
			this.$submit = this.$el.find('input[type='+this.options.submit_type+']');
			this.submit_text = this.$submit.val();

			this._add_input_validation(this, this.inputs);

			//only bother w/ js validation if input patterns and/or required aren't supported
			//add submit EH to form
			this.$el.submit(function() {
				var overide_msg;
				//disable submit if needed - init onsubmit callback
				if(self.options.onsubmit_disable) {
					self._disable_submit();
				}
				//clear msg field
				self.$msg.removeClass('success error').empty();

				//if pre defined fire it off prior to any validation being done
				if(self._pre) {
					self._pre();
				}

				//find all required inputs and make sure a value was entered
				//if nothing entered, flag input and its label with error class
				var valid = true, i;

				if( self.options.force_validate || (!self.input_pattern || !self.required) || self.browser == 'Safari' ) {
					if(self.options.test_checkbox !== false && $.isArray(self.options.test_checkbox)) {
						for (i = self.options.test_checkbox.length - 1; i >= 0; i--) {
							var $checkbox = $('input[type=checkbox][name="'+self.options.test_checkbox[i]+'"]');
							failed_validation = !$checkbox.is(':checked');
							valid = failed_validation && self._fail($checkbox, valid);
						}
					}


					for (i = self.inputs.length - 1; i >= 0; i--) {
						var el = self.inputs[i], $el = $(el), failed_validation = true;

						var required = typeof el.hasAttribute == 'function' ? el.hasAttribute('required') : !!$el.attr('required');
						//test inputs if they are required or if a value has been entered
						if(!required && $el.val() === '') {
							continue;
						}

						//test for number input type because browsers dont actually perform validation
						if($el.attr('type') == 'number') {
							var number_val = $el.val();
							failed_validation = (number_val < el.min || number_val > el.max);
						}
						else { //non number type inputs
							var re = el.getAttribute('pattern');
							if(re !== null && re !== '') { //pattern to check against
								re = re.charAt(0) === '^' ? re : '^'+re;
								failed_validation = $el.val().search(new RegExp(re)) === -1;
							}
							else{ //no pattern, simply make sure the input isnt empty
								failed_validation = $el.val() === '';
							}
							valid = failed_validation ? self._fail($el, valid) : !failed_validation && valid;
						}
					} /* \for loop */
				} /* \if js validation */

				//do any additional validation passed in
				if( self._validation !== false ) {
					self._validation(self._cb(valid));
				}
				else {
					self._finish_validation(valid, overide_msg);
				}

				return false;
			}); /* \$el.submit() */

			//add EH to remove error class from focused elements
			this._remove_error_eh(this, this.inputs);
		}, /* \fval._init */

		_cb : function(valid) {
			var callback = (function(self, valid) {
				return function(status) {
					var overide_msg = '';
					if(valid && !status.valid && status.hasOwnProperty('msg') && status.msg !== '') {
						overide_msg = status.msg;
					}

					valid = status.valid && valid;
					self._finish_validation(valid, overide_msg);
				};
			})(this, valid);

			return callback;

		}, /* \_cb */

		_callback_cb : function() {
			var callback = (function(self) {
				return function() {
					self._enable_submit();
				};
			})(this);

			return callback;
		},

		_finish_validation : function(valid, overide_msg) {
			if(!valid) {
				if(this.options.onsubmit_disable) {
					if(this.$msg !== false) {
						var return_msg = typeof overide_msg !== 'undefined' && overide_msg !== '' ? overide_msg : this.options.failed_validation_msg;
						this.$msg.addClass('error').html(return_msg);
					}
					this._enable_submit();
				}
			}
			else {
				if(this._callback !== false) {
					this._callback(this._callback_cb());
				}
				else {
					this.$el.off('submit');
					this.$el.submit();
				}
			}

			//return false;
		}, /* \_finish_validation */

		_create: function(){

		}, /* \fval._create */

		_destroy: function(){

		},  /* \fval._destroy */

		_find_inputs: function($el) {
			return $el.find('input, textarea, select').not(':input[type=button], :input[type=submit], :input[type=reset], :input[type=radio], :input[type=checkbox]').toArray();
		}, /* \fval._find_inputs */

		_scan: function(redo) {
			redo = redo || false;
			var self = this;
			var updated_inputs = this._find_inputs(this.$el);

			if(redo) { //do full new scan of inputs
				this.inputs = updated_inputs;
				this._add_input_validation(this, this.inputs);
				//add remove error event handling to new inputs
				this._remove_error_eh(this, this.inputs);
			}
			else { //input only got added, we can just look for the new inputs
				var added_inputs = $.grep(updated_inputs, function(el){return $.inArray(el, self.inputs) == -1;});
				//add new inputs to input array
				var l = added_inputs.length;
				if(l > 0) {
					this.inputs = this.inputs.concat(added_inputs);
					this._add_input_validation(this, added_inputs);
					//add remove error event handling to new inputs
					this._remove_error_eh(this, added_inputs);
				}
			}
		}, /* \fval._scan */

		_add_input_validation: function(self, inputs) {
			//set custom validation messages for inputs
			$.each(inputs, function() {
				self._set_custom_validation($(this), this);
			});
		}, /* \_add_inputs */

		_enable_submit: function() {
			this.$submit[0].disabled = '';
			//set EH to clear form msg on input focus
			if ( this.options.reset_msg ) {
				$(this.inputs).one('focus', $.proxy( function() {
					this.$msg.removeClass('success error').empty();
				}, this));
			}
			if(this.options.working_text !== false) {
				this.$submit.val(this.submit_text);
			}
		}, /* \fval._enable_submit */

		_disable_submit: function() {
			this.$submit[0].disabled = 'disabled';
			//if we have working text, update the text
			if(this.options.working_text !== false) {
				this.$submit.val(this.options.working_text);
			}
		}, /* \fval._disable_submit */

		_fail: function($el, valid) {
			$el.addClass(this.options.error_class);

			//test to see if input has explicit label
			var explicit_label = $el.data('label');
			if(explicit_label !== undefined && explicit_label !== '') {
				$(explicit_label).addClass(this.options.error_class);
			}
			else { //if  no explicit label, add error class to std label
				$('label[for="'+$el.attr('id')+'"]').addClass(this.options.error_class);
				//test to see if parent is label i.e. <label><input></label>
				var $parent = $el.parent();
				if($parent.is('label')) {
					$parent.addClass(this.options.error_class);
				}
			}



			return valid && false;
		}, /* \fval._fail() */

		_set_custom_validation: function($el, el) {
			var custom_error = $el.data('validity');
			if(custom_error !== undefined && custom_error !== '' && typeof(el.setCustomValidity) === 'function') {
				$el.on('invalid', function() {
					this.setCustomValidity('');
					if (!this.validity.valid) {
						this.setCustomValidity(custom_error);
					}
				});

				$el.on('input', function(e) {
					e.target.setCustomValidity('');
				});
			}
		}, /* \fval._throw_custom_validation */

		_remove_error_eh: function(self, inputs) {
			//add EH to remove error class from focused elements
			$.each(inputs, function() {
				$(this).on('focus change input', function() {
					var $el = $(this);
					$el.removeClass(self.options.error_class);
					//test to see if input has explicit label
					var explicit_label = $el.data('label');
					if(explicit_label !== undefined && explicit_label !== '') {
						$(explicit_label).removeClass(self.options.error_class);
					}
					else { //if  no explicit label, add error class to std label
						$('label[for="'+$el.attr('id')+'"]').removeClass(self.options.error_class);
						//test to see if parent is label i.e. <label><input></label>
						var $parent = $el.parent();
						if($parent.is('label')) {
							$parent.removeClass(self.options.error_class);
						}
					}
				});
			});
		}, /* \fval._remove_error */

		_browser_sniff: function() {
			var BrowserDetect = {
				init: function () {
					this.browser = this.searchString(this.dataBrowser) || "An unknown browser";
					this.version = this.searchVersion(navigator.userAgent) || this.searchVersion(navigator.appVersion) || "an unknown version";
					this.OS = this.searchString(this.dataOS) || "an unknown OS";
				},
				searchString: function (data) {
					for (var i=0;i<data.length;i++)	{
						var dataString = data[i].string;
						var dataProp = data[i].prop;
						this.versionSearchString = data[i].versionSearch || data[i].identity;
						if (dataString) {
							if (dataString.indexOf(data[i].subString) != -1)
								return data[i].identity;
						}
						else if (dataProp)
							return data[i].identity;
					}
				},
				searchVersion: function (dataString) {
					var index = dataString.indexOf(this.versionSearchString);
					if (index == -1) return;
					return parseFloat(dataString.substring(index+this.versionSearchString.length+1));
				},
				dataBrowser: [
					{
						string: navigator.userAgent,
						subString: "Chrome",
						identity: "Chrome"
					},
					{	string: navigator.userAgent,
						subString: "OmniWeb",
						versionSearch: "OmniWeb/",
						identity: "OmniWeb"
					},
					{
						string: navigator.vendor,
						subString: "Apple",
						identity: "Safari",
						versionSearch: "Version"
					},
					{
						prop: window.opera,
						identity: "Opera",
						versionSearch: "Version"
					},
					{
						string: navigator.vendor,
						subString: "iCab",
						identity: "iCab"
					},
					{
						string: navigator.vendor,
						subString: "KDE",
						identity: "Konqueror"
					},
					{
						string: navigator.userAgent,
						subString: "Firefox",
						identity: "Firefox"
					},
					{
						string: navigator.vendor,
						subString: "Camino",
						identity: "Camino"
					},
					{		// for newer Netscapes (6+)
						string: navigator.userAgent,
						subString: "Netscape",
						identity: "Netscape"
					},
					{
						string: navigator.userAgent,
						subString: "MSIE",
						identity: "Explorer",
						versionSearch: "MSIE"
					},
					{
						string: navigator.userAgent,
						subString: "Gecko",
						identity: "Mozilla",
						versionSearch: "rv"
					},
					{		// for older Netscapes (4-)
						string: navigator.userAgent,
						subString: "Mozilla",
						identity: "Netscape",
						versionSearch: "Mozilla"
					}
				],
				dataOS : [
					{
						string: navigator.platform,
						subString: "Win",
						identity: "Windows"
					},
					{
						string: navigator.platform,
						subString: "Mac",
						identity: "Mac"
					},
					{
						string: navigator.userAgent,
						subString: "iPhone",
						identity: "iPhone/iPod"
					},
					{
						string: navigator.platform,
						subString: "Linux",
						identity: "Linux"
					}
				]

			};
			BrowserDetect.init();
			return BrowserDetect;
		} /* \fval._browser_sniff */

	}; /* \fval.prototype */

	//add obj to namespace
	nxnw.fval = fval;

	return nxnw.fval;

});