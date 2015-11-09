# The top level makefile. Targets like "all" and "clean"
# are defined in the RULES file.

TOP = .
SUBDIRS = src

.PHONY: support, certificates, dev-mongo, dev-config, update

default: 

support: 
	$(TOP)/sbin/traveler_install_support.sh

update: 
	$(TOP)/sbin/traveler_update_support.sh


certificates:
	$(TOP)/sbin/create_web_service_certificates.sh

dev-mongo:
	$(TOP)/sbin/configure_mongo_dev.sh

dev-config: 
	$(TOP)/sbin/create_dev_config.sh