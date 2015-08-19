#LIBRARIES
from django.http import HttpResponseForbidden

#CONTENTIOUS
from contentious.api import api
from contentious.compat import get_request_context


def require_edit_mode(function):
    """ View function decorator for requiring api.in_edit_mode to be True. """
    def replacement(request, *args, **kwargs):
        context = get_request_context(request)
        if not api.in_edit_mode(context):
            return HttpResponseForbidden()
        return function(request, *args, **kwargs)
    return replacement
