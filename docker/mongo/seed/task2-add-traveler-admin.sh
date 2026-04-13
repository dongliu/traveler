# TODO: add more seeding data for admin users
mongoshell="use traveler"
echo -e $mongoshell | mongo -u traveler -p travelerpassword --authenticationDatabase admin
