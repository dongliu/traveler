if (shareGroups) {
  travelerGlobal.groupnames = new Bloodhound({
    datumTokenizer: function(group) {
      return Bloodhound.tokenizers.whitespace(group.name);
    },
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    identify: function(group) {
      return group.name;
    },
    prefetch: {
      url: (prefix ? prefix + '/groupnames' : '/groupnames') + '?deleted=false',
      cacheKey: 'groupnames',
    },
  });
}
