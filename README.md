# Contentious

A Django app for making HTML elements editable.

Contentious is not a translation system, although it could be used for translation.  It is much more than that.  It allows editing of HTML pages by non-HTML savvy users.  It is designed for fixed-layout pages, and you can control to what extent the users can edit the content and you can completely customise the interface through which they do it.

## Features

* Any part of any HTML element can be made editable, this includes any attributes (title, href, src) and/or the contents of the tag itself.
* When you put your page into edit mode these elements become editable in-place by the user.
* You can implement your own storage mechanism for saving and retrieving the content data.
* You can customise the editing dialogue any way you like.  E.g. you could provide TinyMCE for editing the contents of `<div>` tags, or you could provide a grid of images for editing the `src` of an `<img>` tag.

## What This Is Not

* A way to alter a page's layout. It is designed for pre-defined layouts although markup can be added to the content of an editable element.


# Examples

```
<html>
<body>
<!-- A link tag in which the user can edit the title, href and the link text. -->
{% editable a "my_link" editable="content,href,title" class="cheese" href="http://www.google.com/" title=some_variable %}Default Link Text{% endeditable %}

<!-- An iframe tag in which the user can edit the src -->
{% editable iframe "my_video" editable="src" extra="youtube" class="video-popup" %}{% endeditable %}

<!-- A select tag in which the user can edit the entire contents of the select.  You would need to define a custom inteface to allow non-techy users to edit this. -->
{% editable select "my_select" editable="content,title" class="video-popup" %}<option>Cake</option>{% endeditable %}

<!-- An image tag with an editable src and title.  Note that the <img /> tag is self-closing so the django tag is too! -->
{% editable img "my_image" editable="src,title" src="http://www.images.com/1.jpg" %}

<!-- any of the args/kwargs can be passed as template variables, with the exception of the HTML tag name -->
{% editable img variable_for_key|some_filter editable=list_of_editable_attrs src=something.something %}
</body>
</html>
```


## Installation

* Add contentious to `settings.INSTALLED_APPS`.
* Implement your API which must provide the methods defined on the `ContentiousInterface`.
* Set the string path to your interface settings.py, e.g. `CONTENTIOUS_API = 'myapp.api.ContentAPI'`.
* Serve the JS and CSS files via whatever means you like.
* Add the default contentious Ajax view to your URL conf, ` url(r'^whatever-you-like/', include('contentious.urls'))`.  Alternatively you can write your own view and use that.
* Add Javascript to initialize Contentious, passing in the URL to the Ajax-handling view.  You'll also need to give the contentious JS access to your CSRF token.  The easiest way to do all of this is just `{% include "contentious/common_setup.html" %}`.
* Optionally override any of the templates for the editing UI, or simply add CSS/JS to customise them. See [UI Customization] for more info.
* Then just define any of your HTML tags as editable, see [Examples] below.

## Dependencies

* Lightbox for default editing behaviour (this can be changed, see [Changing edit dialog behaviour])

## Contrib Apps

Contentious contains a small collection of 'contrib' apps which provide pre-made models and API interfaces for common use cases such as basic editing and basic translation.  Look in the 'contrib' folder, each app has a README.

## UI Customization

The contentious UI is implemented using a prototype so you can override any behaviour if you need to.

### Changing edit dialog behaviour

To change the edit dialog behaviour you can override the openDialog and closeDialog methods.

```
function MyContentious(){}
MyContentious.prototype = new Contentious({/** config **/});
MyContentious.prototype.openDialog = function($content, $elem){
	// open dialog...
}
MyContentious.prototype.closeDialog = function(){
	// close dialog...
};
var cts = new MyContentious();
```

## Dealing with HTML content
You can define the content of specific tags to be treated as HTML. 
This means Contentious will **not** escape the content before rendering. Also the editor dialogue will display it verbatim inside a textarea (useful if you wish to add the WYSIWYG of your choice for example). You may customize which tags are treated this way by populating the `treatContentAsHTML` option when instantiating the Contentious javascript class.

```
function MyContentious(){}
MyContentious.prototype = new Contentious({
    ...
    'treatContentAsHTML': ['div', 'p']
})

var ctx = new MyContentious();
```

You **must** also mirror this on the Python side by setting the `CONTENTIOUS_TREAT_CONTENT_AS_HTML_TAGS` option in your Django settings file.

```
...
CONTENTIOUS_TREAT_CONTENT_AS_HTML_TAGS = ('div', 'p')
...
```

