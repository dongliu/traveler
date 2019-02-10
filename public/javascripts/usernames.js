if (shareUsers) {
  travelerGlobal.usernames = new Bloodhound({
    datumTokenizer: function(user) {
      return Bloodhound.tokenizers.whitespace(user.displayName);
    },
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    identify: function(user) {
      return user.displayName;
    },
    prefetch: {
      url: prefix ? prefix + '/adusernames' : '/adusernames',
      cacheKey: 'adusernames',
    },
  });
}
