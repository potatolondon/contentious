/*
	Contentious Javascript Plugin.

Usage:
	Instantiate the Contentious class.
	var cts = Contentious(config);

	The config parameter is an object which has a single required property:
	apiURL:
		This is the URL which requests to save updated data should be POST'd to.

	The config can also contain other optional properties:
	editFormConfig:
		An object which can determine the labels and input types for editing different
		attributes of different HTML elements.  See defaultEditFormConfig for the format.
	treatContentAsHTML:
		An array of HTML elements, which when edited should allow the user to edit the
		content as HTML, rather than as text.  Default list is in defaultTreatContentAsHTML.

Events:
	The Contentious plugin fires several events which allow you to hook into parts of the editing
	process and make customisations.

	You can subscribe to these events like a normal jQuery event:
		$(document).on("cts-edit-pre-form-render", function(e){...});

	Or, you can subscribe using the Contentious event bus:
		cts.events.subscribe("cts-edit-pre-form-render", function(el, config, $form){...})

	'cts-edit-pre-form-render':
		This is triggered when an editable element is clicked, before the edit form is rendered.

		params: the clicked element, editFormConfig.

	'cts-edit-post-form-render':
		This is triggered when an editable element is clicked, after the form has been constructed
		but before it is rendered to the page.

		params: the clicked element, editFormConfig, jQuery object of the form which will be shown.

	'cts-edit-post-form-display':
		This is triggered after the form is rendered to the page.  Useful for doing things which can
		only be done when elements are in the DOM.  E.g. adding TinyMCE (shudder).

		params: the clicked element, editFormConfig, jQuery object of the form which is shown.

	'cts-pre-form-submit':
		This is called before the edit form is POST'd.

		params: jQuery object of the form, the clicked element being edited.

	'cts-form-submit-success':
		This is called when the POST request of the edit form has successfully finished.

		params: the jQuery object of the form, the clicked element being edited.

	'cts-form-submit-failure':
		This is called when the POST request of the edit form failed.

		params: the jQuery object of the form, the clicked element being edited, the XHR object.

	'cts-form-submit-invalid':
		This is called when validation has failed for the edit form.

		params: the object containing the field errors, the jQuery object of the form, the clicked element being editing

	'cts-dialog-closed':
		This is triggered after the dialog is closed.

		params: the jQuery object of the form, the clicked element being edited.
*/

var Contentious = (function(){
	var EventBus = function(ctx){
		this.ctx = ctx;
		this.subscriptions = {};
	};

	EventBus.prototype.getTargetEl = function(el){
		if(el.jquery){
			if(!el.length){
				throw "targetEl is empty jQuery object";
			}
			el = el[0];
		}
		return el;
	};

	/**
	 * Subscribes a handler if the target doesn't already have a handler subscribed
	 */
	EventBus.prototype.subscribeIfNoCurrentHandler = function(type, fn, targetEl){
		targetEl = this.getTargetEl(targetEl);
		if(!this.hasSubscription(type, targetEl)){
			this.subscribe(type, fn, targetEl);
		}
	};

	EventBus.prototype.subscribe = function(type, fn, targetEl){
		targetEl = this.getTargetEl(targetEl);

		if(typeof this.subscriptions[type] === 'undefined'){
			this.subscriptions[type] = [];
		}
		this.subscriptions[type].push({'targetElId': $(targetEl).serialize(), 'fn': fn});

		return this;
	};

	EventBus.prototype.publish = function(type, args, targetEl){
		$(targetEl || document).trigger(type, args); // fire off a jquery event
		var subs = this.subscriptions[type],
			i;

		targetEl = this.getTargetEl(targetEl);

		if(typeof subs !== 'undefined'){
			for(i=0;i<subs.length;i++){
				if(typeof targetEl === 'undefined' ||
				typeof subs[i].targetElId === 'undefined' ||
				$(targetEl).serialize() == subs[i].targetElId){
					subs[i].fn.apply(targetEl || this.ctx, args);
				}
			}
		}
	};

	EventBus.prototype.hasSubscription = function(type, targetEl){
		targetEl = this.getTargetEl(targetEl);
		var subs = this.subscriptions[type],
			i;

		if(typeof subs !== 'undefined'){
			for(i=0;i<subs.length;i++){
				if((typeof targetEl === 'undefined' && typeof subs[i].targetEl === 'undefined') ||
					$(targetEl).serialize() == subs[i].targetElId)
				{
					return true;
				}
			}
		}
		return false;
	};

	var klass = function(config){
		this.apiURL = config.apiURL;
		this.config = this.mergeObjects(this.defaultEditFormConfig(), config.editFormConfig || {});
		this.treatContentAsHTML = config.treatContentAsHTML || this.defaultTreatContentAsHTML;

		this.applyEditableClasses();
		this.updateTranslationProgress();

		this.hookUpEvents();

		this.$ctsToolbar = $(".cts-toolbar");
		if (this.$ctsToolbar.length) {
			this.initToolbar(this.$ctsToolbar);
		}

		this.setEnabled(this.config['startEnabled']);

		this.events = new EventBus(this);
	};

	klass.prototype.utils = (function () {
		var getElementDir = function (el) {
				if (window.getComputedStyle) { // all browsers
					return window.getComputedStyle(el, null).getPropertyValue('direction');
				} else {
					return el.currentStyle.direction; // IE5-8
				}
			},
			isRtl = function (el) {
				return getElementDir(el) === 'rtl';
			};

		return {
			'getElementDir': getElementDir,
			'isRtl': isRtl
		}
	})();

	klass.prototype.hookUpEvents = function(){
		$(document)
			.on("click", ".cts-enabled .cts-editable", function(e){e.preventDefault()})
			.on("mouseenter", ".cts-enabled .cts-editable", $.proxy(this.showEditOptions, this))
			.on("mouseleave", ".cts-enabled .cts-editable", $.proxy(this.hideEditOptions, this))
			.on("submit", "#cts-edit-form", $.proxy(this.formSubmit, this));
	};

	klass.prototype.defaultEditFormConfig = function(){
		return {
			'preFormSubmit': undefined,
			'startEnabled': true,
			'labels': {
				'default': {
					'href': 'Link location',
					'src': 'Image URL',
					'alt': 'Image description',
					'title': 'Hover tool tip',
					'content': 'Text content',
					'multiple': 'Allow multiple selections',
					'display': 'Display this element'
				},
				'a': {
					'content': 'Link text',
					'target': 'Target'
				},
				'div': {
					'content': 'HTML content'
				},
				'iframe': {
					'src': 'Page location'
				}
			},
			'titles': {
				'default': 'Edit',
				'a': "Edit Link",
				'img': "Edit Image"
			},
			'inputs': {
				'default': {
					'default': 'input',
					'display': 'input[type="checkbox"]'
				},
				'div': {
					'content': 'textarea'
				},
				'select': {
					'content': 'textarea'
				},
				'ul': {
					'content': 'textarea'
				},
				'a': {
					'target': 'select',
					'target__options': ["_self", "_blank", "_top", "_parent"]
				}
			},
			'optionals': ['title', 'display'],
			'rtlEditables': ['content', 'title', 'alt']
		};
	};

	klass.prototype.defaultTreatContentAsHTML = [
		'div',
		'select',
		'ul'
	];

	klass.prototype.applyEditableClasses = function(){
		var cts = this;
		cts.getAllElements().each(function(){
			var $this = $(this),
				$highlightingElement = cts.getElementToHighlightForElement($this);

			$highlightingElement.addClass("cts-highlight-editable");
			$highlightingElement.addClass($this[0] === $highlightingElement[0] ? "cts-highlight-visible-editable" : "cts-highlight-hidden-editable");

			if($this.hasClass("cts-default-data")){
				$highlightingElement.addClass("cts-highlight-default-data-editable");
			}
		});
	};

	klass.prototype.getAllElements = function(){
		return $('body').find(".cts-editable, .cts-nested-editable");
	};

	klass.prototype.getElementToHighlightForElement = function($editableElement){
		//There may be some editables which are hidden because they're nested inside an element which is display:none or visibility:hidden
		//so find the best element to highlight by traversing up the DOM and returning the first visible element
		var selectorToHighlight = $editableElement.data('cts-highlight-element') || $editableElement.parent().data('cts-highlight-element');
		//If it is an empty editable, we don't want to highlight the parent as well.
		if (selectorToHighlight) {
			var $element = $(selectorToHighlight);
			if (!$element.length){
				throw "No element found to select.";
			}
			return $editableElement;
		}
		else {
			var lowestVisible = this.findLowestVisibleElement($editableElement);
			if (lowestVisible !== null && lowestVisible !== $editableElement) {
				//If the lowest visible element isn't $editableElement then $editableElement is hidden
				return $(lowestVisible);
			}
		}

		return $editableElement;
	};

	klass.prototype.findLowestVisibleElement = function(element) {
		// Similar to above, but head up the tree and find the first element that is visible
		var body = $('body')[0],
			i = element;
		while(i[0] != body) {
			if(!(i.is(":hidden") || i.css('visibility') == 'hidden')) {
				return i;
			}
			i = i.parent();
		}
		return body;
	};

	klass.prototype.copyObject = function(obj){
		//write our own recursive object copying function, because Javascript doesn't have one
		if(typeof obj != 'object' || obj.length !== undefined){
			return obj;
		}
		var copy = {};
		for(var key in obj){
			copy[key] = this.copyObject(obj[key]);
		}
		return copy;
	};

	klass.prototype.mergeObjects = function(obj, overrides){
		if(typeof obj != 'object' || obj.length !== undefined){
			return typeof overrides != 'object' ? overrides : obj;
		}
		var copy = {};
		for(var key in obj){
			copy[key] = this.mergeObjects(obj[key], overrides[key] || {});
		}
		return copy;
	};

	klass.prototype.serializeArray = function($elem){
		var ar = $elem.serializeArray();
		$elem.find('[type=checkbox]').each(function(){
			var name = $(this).attr('name'),
				inAr = false,
				i;
			for(i = 0; i < ar.length; i++){
				if(ar[i].name == name){
					inAr = true;
					break;
				}
			}
			if(!inAr){
				ar.push({name: name, value: this.checked});
			}
		});
		return ar;
	};

	klass.prototype.serializeObject = function($elem){
		var o = {},
			a = this.serializeArray($elem);
		$.each(a, function() {
			if (o[this.name] !== undefined) {
				if (!o[this.name].push) {
					o[this.name] = [o[this.name]];
				}
				o[this.name].push(this.value || '');
			} else {
				o[this.name] = this.value || '';
			}
		});
		return o;
	};

	klass.prototype.setValueOnElement = function($elem, editable, value){
		var tag_name = $elem[0].tagName.toLowerCase();
		if(editable == 'content'){
			if($.inArray(tag_name, this.treatContentAsHTML) != -1){
				$elem.html(value);
			}else{
				$elem.text(value);
			}
		}else if(editable == 'display'){
			$elem.toggleClass('cts-switched-off', !value);
			$elem.data('cts-switched-off', +!value);
		}else{
			$elem.prop(editable, value);
			if(editable == 'href'){
				var fullHref = $elem.prop(editable);
				$('.cts-edit-options').
				filter('[data-cts-elem-id="' + $elem.attr('id') + '"]').
				find('.cts-edit-option-follow').
				prop(editable, fullHref).
				text(fullHref);
			}
		}
	};

	klass.prototype.getCurrentValueFromElement = function($elem, editable){
		var tag_name = $elem[0].tagName.toLowerCase();
		if(editable == 'content'){
			if($.inArray(tag_name, this.treatContentAsHTML) != -1){
				return $elem.html();
			}else{
				return $elem.text();
			}
		}else if (editable == 'href'){
			return $elem.attr(editable);
		}else if (editable == 'display'){
			return !$elem.data('cts-switched-off');
		}
		else{
			return $elem.prop(editable);
		}
	};

	klass.prototype.centralise = function(element, container){
		var $container = $(container),
			$element = $(element),
			containerOffset = $container.offset();
		$element.css('top', containerOffset.top + ($container.outerHeight(true)/2 - $element.height()/2));
		$element.css('left', containerOffset.left + ($container.outerWidth(true)/2 - $element.width()/2));
	};

	klass.prototype.updateTranslationProgress = function(){
		$('.editables-translated').html(this.getAllElements().length - this.getElementsContainingDefaultData().length);
		$('.editables-total').html(this.getAllElements().length);
	};

	klass.prototype.getElementsContainingDefaultData = function(){
		return this.getAllElements().filter(".cts-default-data");
	};

	klass.prototype.getOptionalFieldsForElement = function($elem){
		return ($elem.data("cts-optionals") || '').split(",") + this.config.optionals;
	};

	klass.prototype.showEditOptions = function(e){
		var $elem = $(e.currentTarget),
			key = $elem.data("cts-key"),
			config = this.copyObject(this.config),
			$editOptions = $('.cts-edit-options').filter('[data-cts-elem-id="' + $elem.attr('id') + '"]');

		if(!$editOptions.length){
			$editOptions = this.createEditOptions($elem, config);
		}
		else{
			$editOptions.show();
		}

		$elem.addClass("hover");

		this.centralise($editOptions, $elem);

		e.preventDefault();
	};

	klass.prototype.createEditOptions = function($elem, config){
		var cts = this,
			$editOptions = $('<div/>', {
				'class': 'cts-edit-options',
				'style': 'position:absolute;z-index:99',
				'data-cts-elem-id': $elem.attr('id')
			})
			.appendTo($('body'))
			.on("mouseleave", function(){
				cts.hideEditOptions($elem);
			});

		$('<a/>', {
			'class': 'cts-edit-option-action',
			'text': cts.getFromConfig(config, 'titles', $elem[0].tagName),
			'style': 'display:block'
		}).on('click', function(e){
			cts.showEditDialogue($elem, config);
			e.preventDefault();
		}).appendTo($editOptions);

		$elem.find('.cts-nested-editable').each(function(i, editable){
			$('<a/>', {
				'class': 'cts-edit-option-action',
				'text': cts.getFromConfig(config, 'titles', editable.tagName),
				'style': 'display:block'
			})
			.on('click', function(e){
				cts.showEditDialogue($(editable), config);
				e.preventDefault();
			})
			.appendTo($editOptions);
		});

		if($elem[0].tagName == "A"){
			var href = $elem[0].href,
				$followLink = $('<a/>', {
					'class': 'cts-edit-option-action cts-edit-option-follow',
					'href': href,
					'text': 'Go to: ' + href,
					'target': '_blank',
					'style': 'display:block'
				});
			if(href){
				$followLink.appendTo($editOptions);
			}
		}

		$editOptions.addClass("cts-edit-options-" +
			($editOptions.outerWidth() > $elem.outerWidth() ||
				$editOptions.outerHeight() > $elem.outerHeight() ?
			"outer" :
			"inner")
		);

		return $editOptions;
	};

	klass.prototype.hideEditOptions = function(e){
		var $elem = $(e.currentTarget || e),
			$editOptions = $('.cts-edit-options').filter('[data-cts-elem-id="' + $elem.attr('id') + '"]'),
			offset = $elem.offset(),
			mouseOverElem = offset.left<=e.pageX && offset.left + $elem.outerWidth() > e.pageX &&
					offset.top<=e.pageY && offset.top + $elem.outerHeight() > e.pageY;
		if(!mouseOverElem){
			$elem.removeClass("hover");
			$editOptions.hide();
		}
	};

	klass.prototype.getFromConfig = function(config, item, tag, editable){
		tag = tag.toLowerCase();
		var lookup = config[item];
		lookup = lookup[tag] || lookup['default'];
		if(typeof lookup == 'string'){
			return lookup;
		}
		lookup = lookup[editable] || lookup['default'];
		lookup = lookup || config[item]['default'][editable];
		lookup = lookup || config[item]['default']['default'];
		return lookup;
	};


	klass.prototype.showEditDialogue = function($elem, config){
		var editables = $elem.data("cts-editables").split(",");
		var key = $elem.data("cts-key");
		this.events.publish('cts-edit-pre-form-render', [$elem, config], $elem);
		var $form = this.buildForm($elem, key, editables, config);
		this.events.publish('cts-edit-post-form-render', [$elem, config, $form], $elem);
		this.openDialog($form, $elem);
		this.events.publish('cts-edit-post-form-display', [$elem, config, $form], $elem);
	};

	klass.prototype.getInputOptions = function(input_type, editable, value, $elem){
		return this.getFromConfig(this.config, 'inputs', $elem[0].tagName, editable + "__options");
	};

	klass.prototype.getInputField = function(input_type, editable, value, $elem){
		var id = 'cts-' + editable,
			$inputField;
		if(input_type.indexOf('input') === 0){
			var typeMatch = input_type.match(/input\[type=[\"\']?([a-z]+)[\"\']?]/),
				type = typeMatch ? typeMatch[1] : 'text',
				dir = (this.utils.isRtl($elem.get(0)) && $.inArray(editable, this.config.rtlEditables) > -1) ? 'rtl' : 'ltr';

			$inputField = $('<input/>', {'type': type, 'name': editable, 'value': value, 'id': id, 'dir': dir });
			if(type == "checkbox"){
				$inputField.removeAttr('value').attr("checked", value);
			}
		}
		else if(input_type == 'select'){
			var options = this.getInputOptions(input_type, editable, value, $elem),
				idx;

			$inputField = $('<select/>', {'name': editable, 'id': id});

			for(idx=0;idx<options.length;idx++){
				var opt = options[idx],
					attrs = {'text': opt, 'value': opt};
				if(opt == value){
					attrs.selected = true;
				}
				$("<option/>", attrs).appendTo($inputField);
			}
		}
		else{
			$inputField = $('<textarea/>', {'name': editable, 'id': id}).text(value);
		}
		return $inputField;
	};

	klass.prototype.buildForm = function($elem, key, editables, config){
		var $form = $('<form/>', {'method': 'post', 'id': 'cts-edit-form'}),
			cts = this;
		$.each(
			editables,
			function(index, editable){
				var label_text = cts.getFromConfig(config, 'labels', $elem[0].tagName, editable);
				var input_type = cts.getFromConfig(config, 'inputs', $elem[0].tagName, editable);
				var value = cts.getCurrentValueFromElement($elem, editable);
				var $div = $('<div/>');
				$('<label/>', {'text': label_text, 'for': 'cts-' + editable}).appendTo($div);
				cts.getInputField(input_type, editable, value, $elem).appendTo($div);
				$div.appendTo($form);
			}
		);
		$('<input/>', {'type': 'hidden', 'name': 'key', 'value': key}).appendTo($form);
		$('<button/>', {'type': 'submit'}).text('Save').appendTo($form);
		this.$currentElement = $elem; //this reference is used in the formSubmit function
		return $form;
	};

	klass.prototype.formSubmit = function(e){
		//interupt the form submission and do it with Ajax so that we can do stuff when the POST is done
		var cts = this,
			$form = $(e.currentTarget || e),
			$elem = this.$currentElement;

		// Prevent double-submissions
		$form.find('[type=submit]').attr('disabled','disabled');

		try{
			cts.events.publish('cts-pre-form-submit', [$form, $elem], $form);
		}catch(e){
			log(e);
		}
		//Define the success and failure methods as nested functions so that $form is still available
		function formSubmitSuccess(data, status){
			cts.events.publish('cts-form-submit-success', [$form, $elem], $form);
			$elem.removeClass('cts-default-data');
			$elem.closest('.cts-highlight-default-data-editable').removeClass('cts-highlight-default-data-editable');
			cts.updateEditedElement($elem, $form);
			cts.updateTranslationProgress();
			cts.closeDialog();
			cts.events.publish('cts-dialog-closed', [$form, $elem], $form);
		}
		function formSubmitFailure(xhr, error, status){
			cts.events.publish('cts-form-submit-failure', [$form, $elem, xhr], $form);
			$form.find('[type=submit]').removeAttr('disabled');
			var errors = JSON.parse(xhr.responseText || "{}");
			cts.attachErrorsToForm(errors, $form);
		}
		var errors = cts.validate($elem, $form);

		if($.isEmptyObject(errors)){

			$.ajax({
				url: cts.apiURL,
				type: "POST",
				data: $.param(cts.serializeArray($form)),
				success: formSubmitSuccess,
				error: formSubmitFailure
			});
		}
		else{
			cts.events.publish('cts-form-submit-invalid', [errors, $form, $elem], $form);
			cts.addErrors(errors, $form, $elem);
		}
		return false;
	};

	klass.prototype.validate = function($elem, $form){
		var editables = $elem.data("cts-editables").split(","),
			optionals = this.getOptionalFieldsForElement($elem),
			formData = this.serializeObject($form),
			errors = {};
		$.each(editables, function(i, item){
			if(optionals.indexOf(item) == -1 && !$.trim(formData[item]).length){
				if(typeof errors[item] === 'undefined'){
					errors[item] = [];
				}
				errors[item].push(item + " cannot be empty");
			}
		});
		return errors;
	};

	klass.prototype.attachErrorsToForm = function(errors, $form){
		//Given an object of field:array_of_errors mappings, attach them to the fields in the form
		//Any non field errors are expected to be in an array under the key __all__
		//Assumes that the error messages are HTML safe
		for(var key in errors){
			var $error_ul = $('<ul />', {'class': 'errorlist'});
			var error_list = errors[key];
			if(typeof error_list === "string"){
				error_list = [error_list];
			}
			for(var i = 0; i < error_list.length; i++){
				$('<li/>').html(error_list[i]).appendTo($error_ul);
			}
			var $field = $form.find("[name='" + key + "']");
			if($field){
				$error_ul.prependTo($field.closest("div"));
			}else if(key == "__all__"){
				$error_ul.prependTo($form);
			}
			//else... don't know where to put it, ignore
		}
	};

	klass.prototype.updateEditedElement = function($elem, $form){
		var cts = this,
			data = this.serializeArray($form),
			editables = $elem.data("cts-editables").split(",");
		$.each(
			data,
			function(index, item){
				var editable = item.name, value = item.value;
				if($.inArray(editable, editables) == -1){
					return;
				}
				cts.setValueOnElement($elem, editable, value);
			}
		);
	};

	klass.prototype.initToolbar = function ($toolBar) {
		var $clsHighlightVisibleBtn = $toolBar.find(".cts-highlight-visible-editables"),
			$clsHighlightHiddenBtn = $toolBar.find(".cts-highlight-hidden-editables"),
			$clsHighlightAllBtn = $toolBar.find(".cts-highlight-editables"),
			$clsHighlightDefaultDataBtn = $toolBar.find(".cts-highlight-default-data-editables"),
			highlightBtnClickHandler = $.proxy(this.highlightBtnClickHandler, this);

		$clsHighlightVisibleBtn.on("click", {"highlightClass": "cts-highlight-visible-editables"}, highlightBtnClickHandler);
		$clsHighlightHiddenBtn.on("click", {"highlightClass": "cts-highlight-hidden-editables"}, highlightBtnClickHandler);
		$clsHighlightAllBtn.on("click", {"highlightClass": "cts-highlight-editables"}, highlightBtnClickHandler);
		$clsHighlightDefaultDataBtn.on("click", {"highlightClass": "cts-highlight-default-data-editables"}, highlightBtnClickHandler);

		var toolBarHeight = $toolBar.height(); //we need this in order to restore the toolbar to its original height after collapsing it
		var $expandButton = $('.cts-toolbar-open');
		var $collapseButton = $('.cts-toolbar-close');
		var $buttonContainer = $('.expand-collapse-buttons');
		var cookie_toolbar_state = document.cookie.replace(/(?:(?:^|.*;\s*)toolbar_state\s*\=\s*([^;]*).*$)|^.*$/, "$1");
		var date = new Date();
		var expiryDate;

		date.setTime(date.getTime()+(30*24*60*60*1000)); // One months should do...
		expiryDate = "; expires="+date.toGMTString();

		$expandButton.hide(); //needs to be display block, hence we can't hide it with CSS, hence hiding it here

		$collapseButton.on("click", function(){
			//get the size of the expandButton, as this is what we want to reduce our toolbar to
			var width = $buttonContainer.outerWidth();
			var height = $buttonContainer.outerHeight();
			var size = Math.max(width, height);
			$collapseButton.hide();
			$toolBar.animate({'width': size + 'px', 'height': size + 'px'}, function(){
				$expandButton.show();
				$toolBar.addClass('collapsed');
			});
			document.cookie = 'toolbar_state=collapsed' + expiryDate;
		});
		$expandButton.on("click", function(){
			$expandButton.hide();
			$toolBar.animate({'width':'100%', 'height': toolBarHeight}, function(){
				$collapseButton.show();
				$toolBar.removeClass('collapsed');
			});
			document.cookie = 'toolbar_state=expanded' + expiryDate;
		});

		if(cookie_toolbar_state == 'collapsed'){
			var width = $buttonContainer.outerWidth();
			var height = $buttonContainer.outerHeight();
			var size = Math.max(width, height);
			$toolBar.addClass('collapsed');
			$toolBar.width(size + 'px');
			$toolBar.height(size + 'px');
			$collapseButton.hide();
			$expandButton.show();
		}
	};

	klass.prototype.highlightBtnClickHandler = function (e) {
		var $btn = $(e.currentTarget),
			highlightClass = e.data["highlightClass"],
			selectedClass = "selected";

		$('body').toggleClass(highlightClass, !$btn.hasClass(selectedClass));
		$btn.toggleClass(selectedClass);
	};

	klass.prototype.setEnabled = function (enabled){
		$('body').toggleClass("cts-enabled", enabled);
	};

	klass.prototype.openDialog = function($form, $elem){
		$.fancybox({'content': $form});
	};

	klass.prototype.closeDialog = function(){
		$.fancybox.close();
	};

	klass.prototype.addErrors = function(errors, $form, $elem){
		$form.find('[type=submit]').removeAttr('disabled');
		$.each($form.find('input, textarea, select'), function(){
			var $input = $(this),
				name = $input.attr('name'),
				errorMessages = errors[name];

			if(errorMessages && errorMessages.length){
				$input.addClass('cts-input-error');
				var $errorPara = $input.siblings('p.cts-errormessage');

				if(!$errorPara.length){
					$errorPara = $('<p>', {'class': 'cts-errormessage'}).insertAfter($input);
				}

				$errorPara.text(errorMessages.join(', '));
			}
		});
	};

	return klass;
})();
