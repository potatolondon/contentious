#LIBRARIES
from django.core.cache import cache
from django.http import HttpRequest
from django.test import TestCase
from django.test.utils import override_settings

#CONTENTIOUS
from contentious.compat import get_request_context
from .api import BasicEditAPI



class APITest(TestCase):
    """ Tests for the BasicEditAPI. """

    urls = 'contentious.tests.urls'

    @override_settings(TEMPLATE_CONTEXT_PROCESSORS=["django.core.context_processors.request",])
    def test_save_and_get_data(self):
        api = BasicEditAPI()
        request = HttpRequest()
        request.path = '/test_view/'
        context = get_request_context(request)
        #First test that trying to get content for something that hasn't been saved returns {}
        result = api.get_content_data('some_key', context)
        self.assertEqual(result, {})
        #Now save some data
        data = {'content': 'pineapple', 'href': 'http://www.google.com/'}
        api.save_content_data('some_key', data, context)
        #Now calling get_content_data should return that data
        result = api.get_content_data('some_key', context)
        self.assertIsSubDict(data, result)
        #And now even if we have a new request object (so that there's no on-request caching)
        #and even if memcache is cleared, we should still get the same result
        cache.clear()
        request = HttpRequest()
        request.path = '/test_view/'
        context = get_request_context(request)
        result = api.get_content_data('some_key', context)
        self.assertIsSubDict(data, result)

    def assertIsSubDict(self, subdict, superdict):
        for k, v in subdict.items():
            self.assertTrue(k in superdict)
            self.assertEqual(superdict[k], v)
