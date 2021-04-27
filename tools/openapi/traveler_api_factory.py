from travelerApi import Configuration, ApiClient, TravelerApi, DataApi, FormApi, BinderApi


class TravelerApiFactory:

	def __init__(self, host, username, password):
		config = Configuration(host=host, username=username, password=password)
		client = ApiClient(configuration=config)
		self.traveler_api = TravelerApi(api_client=client)
		self.data_api = DataApi(api_client=client)
		self.form_api = FormApi(api_client=client)
		self.binder_api = BinderApi(api_client=client)

	def get_traveler_api(self):
		return self.traveler_api

	def get_date_api(self):
		return self.data_api

	def get_form_api(self):
		return self.form_api

	def get_binder_api(self):
		return self.binder_api


if __name__ == "__main__":
	factory = TravelerApiFactory(host='http://traveler:3443', username='api_write', password='')

	traveler_api = factory.get_traveler_api()
	print(traveler_api.get_travelers()[0].id)

	data_api = factory.get_date_api()
	print(data_api.get_data_by_id('6081eb156ddf0c251849dca0').id)

	form_api = factory.get_form_api()
	print(form_api.get_forms()[0].id)

	binder_api = factory.get_binder_api()
	print(binder_api.get_binders()[0].id)
