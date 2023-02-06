// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * GOSH contracts
 *
 * Copyright (C) 2022 Serhii Horielyshev, GOSH pubkey 0xd060e0375b470815ea99d6bb2890a2a726c5b0579b83c742f5bb70e10a771a04
 */
pragma ever-solidity >=0.66.0;
pragma AbiHeader expire;
pragma AbiHeader pubkey;
pragma AbiHeader time;

import "./modifiers/modifiers.sol";
import "./libraries/GoshLib.sol";
import "goshwallet.sol";
import "goshdao.sol";

/* Root contract of task */
contract Task is Modifiers{
    string constant version = "1.1.0";
    
    string static _nametask;
    address _repo;
    bool _ready = false;
    address _systemcontract;
    address _goshdao;
    mapping(uint8 => TvmCell) _code;
    ConfigCommit[] _candidates;   
    ConfigGrant _grant;
    uint128 _indexFinal;
    uint128 public _locktime = 0;
    uint128 _fullAssign = 0;
    uint128 _fullReview = 0;
    uint128 _fullManager = 0;
    mapping(address => uint128) _assigners;
    uint128 _assignfull = 0;
    uint128 _assigncomplete = 0;
    bool _allassign = false;
    bool _allreview = false;
    bool _allmanager = false;
    uint128 _lastassign = 0;
    uint128 _lastreview = 0;
    uint128 _lastmanager = 0;
    uint128 _balance;
    
    constructor(
        address repo,    
        address goshaddr,
        address goshdao,
        TvmCell WalletCode,
        ConfigGrant grant,
        uint128 balance
        ) public senderIs(goshdao) {
        require(_nametask != "", ERR_NO_DATA);
        tvm.accept();
        _code[m_WalletCode] = WalletCode;
        _systemcontract = goshaddr;
        _goshdao = goshdao;
        _repo = repo;
        _grant = grant;
        _balance = balance;
    }
 /*   
    function setConfig(ConfigGrant grant, uint128 index) public {
        require(_ready == false, ERR_TASK_COMPLETED);
        checkAccess(_pubaddr, msg.sender, index);
        _grant = grant;
    } 
 */   
    function isReady(ConfigCommit commit) public senderIs(_repo) {
        require(_ready == false, ERR_TASK_COMPLETED);
        _candidates.push(commit);
    } 
    
    function confirmSmv(address pubaddr, uint128 index1, uint128 index2) public {
       require(_ready == false, ERR_TASK_COMPLETED);
       require(index1 < _candidates.length, ERR_TASK_COMPLETED);
       checkAccess(pubaddr, msg.sender, index2);
        _ready = true;
        _indexFinal = index1;
        _locktime = now;
        _assignfull = _candidates[_indexFinal].size;
    }
    
    function getGrant(address pubaddr, uint128 typegrant, uint128 index) public view {
        require(_ready == true, ERR_TASK_NOT_COMPLETED);
        require(now >= _locktime, ERR_NOT_READY);
        checkAccess(pubaddr, msg.sender, index); 
        tvm.accept();
        if (m_assign == typegrant) {
            require(_candidates[_indexFinal].pubaddrassign.exists(pubaddr), ERR_ASSIGN_NOT_EXIST);
            this.getGrantAssign{value: 0.2 ton}(pubaddr);
        }
        if (m_review == typegrant) {
            require(_candidates[_indexFinal].pubaddrreview == pubaddr, ERR_REVIEW_NOT_EXIST);
            this.getGrantReview{value: 0.2 ton}(pubaddr);
        }
        if (m_manager == typegrant) {
            require(_candidates[_indexFinal].pubaddrmanager == pubaddr, ERR_MANAGER_NOT_EXIST);
            this.getGrantManager{value: 0.2 ton}(pubaddr);
        }    
    }
    
    function getGrantAssign(address pubaddr) public senderIs(address(this)) {
        uint128 check = 0;
        for (uint128 i = _lastassign; i < _grant.assign.length; i++){
            check += 1;
            if (check == 6) { this.getGrantAssign{value: 0.2 ton}(pubaddr); }
            if (now >= _grant.assign[i].lock + _locktime) { 
                _fullAssign += _grant.assign[i].grant; 
                _grant.assign[i].grant = 0; 
                _lastassign = i + 1;
                if (i == _grant.assign.length - 1) { _allassign = true; } 
            } else { break; }
        }
        uint128 diff = _fullAssign / _assignfull - _assigners[pubaddr];
        _balance -= diff;
        if (diff == 0) { return; }
        _assigners[pubaddr] = _fullAssign / _assignfull;
        if ((_allassign == true) && (diff != 0)) { _assigncomplete += 1; }
        TvmCell s1 = _composeWalletStateInit(pubaddr, 0);
        address addr = address.makeAddrStd(0, tvm.hash(s1));
        GoshWallet(addr).grantToken{value: 0.1 ton}(_nametask, _repo, diff);
        checkempty();
        return;
    }
    
    function getGrantReview(address pubaddr) public senderIs(address(this)) {
        uint128 check = 0;
        for (uint128 i = _lastreview; i < _grant.review.length; i++){
            check += 1;
            if (check == 6) { this.getGrantReview{value: 0.2 ton}(pubaddr); }
            if (now >= _grant.review[i].lock + _locktime) { 
                _fullReview += _grant.review[i].grant; 
                _grant.review[i].grant = 0; 
                _lastreview = i + 1;
                if (i == _grant.review.length - 1) { _allreview = true; } 
            } else { break; }
        }
        _balance -= _fullReview;
        TvmCell s1 = _composeWalletStateInit(pubaddr, 0);
        address addr = address.makeAddrStd(0, tvm.hash(s1));
        GoshWallet(addr).grantToken{value: 0.1 ton}(_nametask, _repo, _fullReview);
        _fullReview = 0;
        checkempty();
        return;
    }
    
    function getGrantManager(address pubaddr) public senderIs(address(this)) {
        uint128 check = 0;
        for (uint128 i = _lastmanager; i < _grant.manager.length; i++){
            check += 1;
            if (check == 6) { this.getGrantManager{value: 0.2 ton}(pubaddr); }
            if (now >= _grant.manager[i].lock + _locktime) { 
                _fullReview += _grant.manager[i].grant; 
                _grant.manager[i].grant = 0; 
                _lastmanager = i + 1;
                if (i == _grant.manager.length - 1) { _allmanager = true; } 
            } else { break; }
        }
        _balance -= _fullManager;
        TvmCell s1 = _composeWalletStateInit(pubaddr, 0);
        address addr = address.makeAddrStd(0, tvm.hash(s1));
        GoshWallet(addr).grantToken{value: 0.1 ton}(_nametask, _repo, _fullManager);
        _fullManager = 0;
        checkempty();
        return;
    }
    
    function checkAccess(address pubaddr, address sender, uint128 index) internal view returns(bool) {
        TvmCell s1 = _composeWalletStateInit(pubaddr, index);
        address addr = address.makeAddrStd(0, tvm.hash(s1));
        return addr == sender;
    }
    
    function checkempty() private {
        if (_assigncomplete != _assignfull) { return; }
        if (_allreview == false) { return; }
        if (_allmanager == false) { return; }
        GoshDao(_goshdao).returnTaskToken{value: 0.2 ton}(_nametask, _repo, _balance);
        selfdestruct(giver);
    }
    
    
    function _composeWalletStateInit(address pubaddr, uint128 index) internal view returns(TvmCell) {
        TvmCell deployCode = GoshLib.buildWalletCode(_code[m_WalletCode], pubaddr, version);
        TvmCell _contract = tvm.buildStateInit({
            code: deployCode,
            contr: GoshWallet,
            varInit: {_systemcontract : _systemcontract, _goshdao: _goshdao, _index: index}
        });
        return _contract;
    }
    
    //Selfdestruct
    
    function destroy(address pubaddr, uint128 index) public {
        require(checkAccess(pubaddr, msg.sender, index), ERR_SENDER_NO_ALLOWED);
        require(_ready == false, ERR_TASK_COMPLETED);
        GoshDao(_goshdao).returnTaskToken{value: 0.2 ton}(_nametask, _repo, _balance);
        selfdestruct(giver);
    }
    
    //Getters    
    function getStatus() external view returns(string, address, ConfigCommit[], ConfigGrant, bool, uint128) {
        return (_nametask, _repo, _candidates, _grant, _ready, _indexFinal);
    }
    function getVersion() external pure returns(string, string) {
        return ("task", version);
    }
}
