from django.template import RequestContext

# Django 1.8 does not render context processors when you create the object
# RequestContext, but instead when you are rendering it into a template.

# If 'request' is not in the created context, we manually add it.
def get_request_context(request):
    context = RequestContext(request)

    if 'request' not in context:
        context.update({'request': request})

    return context
