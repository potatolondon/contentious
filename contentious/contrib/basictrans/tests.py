# -*- coding: utf-8 -*-

#LIBRARIES
from django.core.cache import cache
from django.http import HttpRequest
from django.test import TestCase

#CONTENTIOUS
from contentious.compat import get_request_context
from .api import BasicTranslationAPI


class APITest(TestCase):
    """ Tests for the BasicTranslationAPI. """

    urls = "contentious.tests.urls"

    def test_save_and_get_data_with_multiple_languages(self):
        api = BasicTranslationAPI()
        # Create an request with the language set to English
        request_en = HttpRequest()
        request_en.path = '/test_view/'
        request_en.language = "en-UK"
        context_en = get_request_context(request_en)
        # Create an request with the language set to Spanish
        request_es = HttpRequest()
        request_es.path = '/test_view/'
        request_es.language = "es-ES"
        context_es = get_request_context(request_es)

        #First test that trying to get content for something that hasn't been saved returns {}
        result_en = api.get_content_data('some_key', context_en)
        result_es = api.get_content_data('some_key', context_es)
        self.assertEqual((result_en, result_es), ({}, {}))

        #Now save some data
        data_en = {'content': u'pineapple', 'href': u'http://www.google.com/'}
        data_es = {'content': u'piña', 'href': u'http://www.google.es/'}
        api.save_content_data('some_key', data_en, context_en)
        api.save_content_data('some_key', data_es, context_es)
        #Now calling get_content_data should return that data
        result_en = api.get_content_data('some_key', context_en)
        result_es = api.get_content_data('some_key', context_es)
        self.assertIsSubDict(data_en, result_en)
        self.assertIsSubDict(data_es, result_es)

        #And now even if we have a new request object (so that there's no on-request caching)
        #and even if memcache is cleared, we should still get the same result
        cache.clear()

        request_en = HttpRequest()
        request_en.path = '/test_view/'
        request_en.language = "en-UK"
        context_en = get_request_context(request_en)

        request_es = HttpRequest()
        request_es.path = '/test_view/'
        request_es.language = "es-ES"
        context_es = get_request_context(request_es)

        result_en = api.get_content_data('some_key', context_en)
        result_es = api.get_content_data('some_key', context_es)
        self.assertIsSubDict(data_en, result_en)
        self.assertIsSubDict(data_es, result_es)

    def assertIsSubDict(self, subdict, superdict):
        for k, v in subdict.items():
            self.assertTrue(k in superdict)
            self.assertEqual(superdict[k], v)
