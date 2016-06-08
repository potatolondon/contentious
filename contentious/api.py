from importlib import import_module

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class ContentiousInterface(object):
    """ Defines the interface which your site needs to implement in order to
        use contentious.
    """

    def in_edit_mode(self, template_context):
        """ Are we currently in edit mode? """
        pass

    def get_content_data(self, key, template_context):
        """ Return a dictionary of the data for this editable content.
            This would typically be:
            MyContentItemModel.objects.get(key=key).__dict__.
            If there is no data saved for the given key it should return an empty dict.
        """
        pass

    def save_content_data(self, key, data, template_context):
        """ TODO: describe what should happen here. """
        pass

    def pre_render(self, tag_spec, meta):
        """ Optional method.  Allows you to modify the spec of HTML tags being
            built from {% editable %} before they are rendered.
            args:
                tag_spec - a dict containing the data used to build the HTML tag.
                meta - a dict of other data about the tag.
            returns:
                tag_spec - butchered in whatever way you see fit.
        """
        pass


def get_api():
    """ Get the current site's API implementation, as defined in settings.py.
    """
    try:
        api_class_string = settings.CONTENTIOUS_API
    except AttributeError:
        raise ImproperlyConfigured(
            "You must define CONTENTIOUS_API in settings.py"
        )
    module, class_name = api_class_string.rsplit(".", 1)
    module = import_module(module)
    api_class = getattr(module, class_name)
    return api_class()

api = get_api()
