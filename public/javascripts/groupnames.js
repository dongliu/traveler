if (shareGroups) {
  travelerGlobal.groupnames = new Bloodhound({
    datumTokenizer: function(group) {
      return Bloodhound.tokenizers.whitespace(group._id);
    },
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    identify: function(group) {
      return group._id;
    },
    prefetch: {
      url: (prefix ? prefix + '/groupnames' : '/groupnames') + '?deleted=false',
      cacheKey: 'groupnames',
    },
  });
}
