// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./EIP712MetaTransaction.sol";

contract Vybo is
    Initializable,
    ERC721EnumerableUpgradeable,
    OwnableUpgradeable,
    EIP712MetaTransaction
{
    // used for the event end time validation
    uint256 public endTime;

    // to store a custom base ipfs URI
    string public baseURI;

    // used to prevent the reentrancy attacks
    bool private reentrancyLock;

    // used to allow users to mint / burn the NFTs as per the threshold
    uint256 public maximumBatchThreshold;

    // Storing the tokenURI with respect to tokenId
    mapping(uint256 => string) public tokenIdToTokenURI;

    // initialize is a replacable function constructor which is not support for upgradable contracts
    // all variable initialation should happen inside initialize function orelse it won't be set its value
    // the order of the variables declaration is important and we should change the order while upgrading the contracts
    function initialize(
        string memory _name,
        string memory _symbol,
        string memory _version
    ) public initializer {
        __ERC721_init(_name, _symbol);
        __Ownable_init();
        __EIP712MetaTransaction_init(_name, _version);
        maximumBatchThreshold = 25;
        reentrancyLock = false;
    }

    /* Prevent a contract function from being reentrant-called. */
    modifier reentrancyGuard() {
        if (reentrancyLock) {
            revert();
        }
        reentrancyLock = true;
        _;
        reentrancyLock = false;
    }

    // to indicate opensea that our metadata and image is stored in ipfs and non editable
    event PermanentURI(string _value, uint256 indexed _id);

    function mint(address receiver, string[] memory _tokenURIs)
        external
        reentrancyGuard
        returns (uint256[] memory)
    {
        uint256 supply = totalSupply();
        require(_tokenURIs.length > 0, "Minimum mintable threshold is 1");
        require(
            _tokenURIs.length <= maximumBatchThreshold,
            "Cannot exceeds the maximum mintable threshold"
        );

        uint256[] memory tokenIds = new uint256[](_tokenURIs.length);

        for (uint256 i = 1; i <= _tokenURIs.length; i++) {
            tokenIdToTokenURI[supply + i] = _tokenURIs[i - 1];
            _safeMint(receiver, supply + i);
            tokenIds[i - 1] = supply + i;
            emit PermanentURI(_tokenURIs[i - 1], supply + i);
        }

        return tokenIds;
    }

    // Overriding the openzeppelin, which will take our ipfs hashed tokenURI
    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        string memory currentBaseURI = _baseURI();
        string memory currentTokenURI = tokenIdToTokenURI[tokenId];
        return
            (bytes(currentBaseURI).length > 0 &&
                bytes(currentTokenURI).length > 0)
                ? string(abi.encodePacked(currentBaseURI, currentTokenURI))
                : "";
    }

    // See which address owns which tokens
    function tokensOfOwner(address _addr)
        public
        view
        returns (uint256[] memory)
    {
        require(_addr != address(0), "Invalid address to reserve.");
        uint256 tokenCount = balanceOf(_addr);
        uint256[] memory tokenIds = new uint256[](tokenCount);
        for (uint256 i; i < tokenCount; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(_addr, i);
        }
        return tokenIds;
    }

    function burn(uint256[] memory _tokenIds) public reentrancyGuard onlyOwner {
        require(_tokenIds.length > 0, "Minimum burn threshold is 1");
        require(
            _tokenIds.length <= maximumBatchThreshold,
            "Cannot exceeds the maximum burn threshold"
        );

        for (uint256 i = 0; i < _tokenIds.length; i++) {
            _burn(_tokenIds[i]);
        }
    }

    function setEndTime(uint256 _value) public onlyOwner {
        endTime = _value;
    }

    function setBaseURL(string memory _value) public onlyOwner {
        baseURI = _value;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId);
        require(endTime > block.timestamp, "Show is completed / Cancelled ");
    }

    function bulkFetchTokenData(uint256[] memory tokenIds)
        public
        view
        returns (string[] memory)
    {
        string[] memory url = new string[](tokenIds.length);

        for (uint256 index = 0; index < tokenIds.length; index++) {
            url[index] = tokenURI(tokenIds[index]);
        }

        return url;
    }
}
