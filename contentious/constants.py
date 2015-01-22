from django.conf import settings


SELF_CLOSING_HTML_TAGS = ['img', 'br', 'hr', 'meta']


#Note, the Javascript plugin has its own seprate copy of this:
TREAT_CONTENT_AS_HTML_TAGS = getattr(settings,
    'CONTENTIOUS_TREAT_CONTENT_AS_HTML_TAGS', ['div', 'select', 'ul'])
