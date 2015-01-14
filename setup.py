#!/usr/bin/env python

from distutils.core import setup
from setuptools import find_packages

PACKAGES = find_packages()

setup(name='Contentious',
      version='1.0',
      description='A Django app for making HTML elements editable',
      author='Adam Alton - Potato London Ltd',
      author_email='adam@potatolondon.com',
      url='https://github.com/potatolondon/contentious',
      packages=PACKAGES,
      include_package_data=True,
     )
