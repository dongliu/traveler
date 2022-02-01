"""
DEV NOTE: To publish API
# Update version in this file
python3 setup.py sdist
twine upload dist/(specific version file)
"""

from setuptools import setup
from setuptools import find_packages

setup(name='Traveler-API',
      version='1.5.4',
      packages=find_packages(),
      py_modules=["traveler_api_factory"],
      install_requires=['python-dateutil',
          'urllib3',
          'six'],
      license='Copyright (c) 2015 Dong Liu, Dariusz Jarosz',
      description='Python APIs used to communicate with traveler API.',
      maintainer='Dariusz Jarosz',
      maintainer_email='djarosz@aps.anl.gov',
      url='https://github.com/AdvancedPhotonSource/traveler'
      )
