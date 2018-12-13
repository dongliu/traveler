"""
Utility that allows updating existing traveler instances with keys that are now defined in the form.

Requires a python environment with pymongo installed.
"""

import os
import pprint

from pymongo import MongoClient

try:
	mongo_host = os.environ['MONGO_SERVER_ADDRESS']
	mongo_port = os.environ['MONGO_SERVER_PORT']
	mongo_port = int(mongo_port)
	mongo_user = os.environ['MONGO_TRAVELER_USERNAME']
	mongo_pass_dir = os.environ['MONGO_TRAVELER_PASSWD_FILE']
except KeyError, er:
	print 'Missing Keys Error: %s' % er
	print 'Please define environment variables: MONGO_SERVER_ADDRESS, MONGO_SERVER_PORT, MONGO_TRAVELER_USERNAME, MONGO_TRAVELER_PASSWD_FILE'
	print 'Alternatively if you use traveler support mongo db, you can source etc/mongo-configuration.sh'

	exit(1)


f = open(mongo_pass_dir, 'r')
mongo_pass = f.readline()
mongo_pass = mongo_pass.rstrip('\n')

mongo_url = "mongodb://%s:%s@%s:%s" % (mongo_user, mongo_pass, mongo_host, mongo_port)

client = MongoClient(host=mongo_host, port=mongo_port, username=mongo_user, password=mongo_pass, authSource="traveler")

traveler_db = client['traveler']
forms_col = traveler_db['forms']
travelers_col = traveler_db['travelers']


forms = forms_col.find()

for form in forms:
	print '\n**************************************************************\n'
	summary_information = {}

	form_id = form['_id']

	summary_information['form'] = form_id
	summary_information['travelers'] = []

	travelers = travelers_col.find({'referenceForm': form_id})

	labels = None
	key_map = None

	if 'labels' in form:
		labels = form['labels']
	if 'mapping' in form:
		key_map = form['mapping']

	for traveler in travelers:
		summary_traveler = {}

		traveler_id = traveler['_id']
		summary_traveler['traveler'] = traveler_id
		summary_traveler['adding_keys'] = False
		summary_traveler['adding_labels'] = False

		html = traveler['forms'][0]['html']

		new_key_map = {}
		new_labels = {}

		if key_map is not None:
			if 'mapping' not in traveler:
				for key in key_map:
					input_id = key_map[key]

					if html.__contains__(input_id):
						new_key_map[key] = input_id

		if labels is not None:
			if 'labels' not in traveler:
				for input_id in labels:
					if html.__contains__(input_id):
						new_labels[input_id] = labels[input_id]

		if new_key_map or new_labels:
			update_fields = {}
			if new_key_map:
				summary_traveler['adding_keys'] = True
				update_fields['mapping'] = new_key_map

			if new_labels:
				summary_traveler['adding_labels'] = True
				update_fields['labels'] = new_labels

			update_doc = {'$set': update_fields}
			travelers_col.update_one({'_id': traveler_id}, update_doc)

		summary_information['travelers'].append(summary_traveler)

	pprint.pprint(summary_information)
