#LIBRARIES
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.views.decorators.http import require_POST

#CONTENTIOUS
from contentious.api import api
from contentious.compat import get_request_context
from contentious.decorators import require_edit_mode
from contentious.utils import json_response_from_exception


@require_POST
@require_edit_mode
def save_content(request):
    """ View for creating/updating a piece of content. """
    #Make a copy of request.POST, but as a single-value (not multi-value dict)
    post = request.POST
    data = {k: post.get(k) for k in post.keys()}
    key = data.pop('key')
    data.pop('csrfmiddlewaretoken', None)
    try:
        api.save_content_data(key, data, get_request_context(request))
        return HttpResponse('ok')
    except ValidationError as e:
        return json_response_from_exception(e)
