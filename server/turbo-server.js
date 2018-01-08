"use strict";

var Path = require('path');
var backendPlus = require("backend-plus");
var MiniTools = require('mini-tools');

var changing = require('best-globals').changing;
var likeAr = require('like-ar');
var fs = require('fs-extra');

var serveContent = require('serve-content');
var serveIndex = require('serve-index');
var html = require('js-to-html').html;
var moment = require('moment');
var numeral = require('numeral');

serveContent.transformer.html={name:'serveJade'   , optionName:'jade', withFlash:true};

if(serveIndex.allowedErrorCodes){
    serveIndex.allowedErrorCodes.EBUSY=true;
    serveIndex.allowedErrorCodes.EPERM=true;
}

class AppTurboServer extends backendPlus.AppBackend{
    constructor(){
        super();
    }
    addUnloggedServices(mainApp, baseUrl){
        var be = this;
        var serveIndexConf = {
            // hidden: true,
            icons: true,
            view: 'details',
            template: function(locals, done){
                if(locals.directory.match(/\/$/)){
                    locals.directory=locals.directory.replace(/\/$/,'');
                }
                var pathParts=locals.directory.split('/');
                var pathToRoot=pathParts.map(x => '..').join('/');
                var content=html.div({'class':'main-dir'},
                [ 
                    html.div({'class':'path-title'},pathParts.map(function(part, index, parts){
                        if(index==parts.length-1){
                            return html.span(part);
                        }
                        return html.span([html.a({href: parts.slice(0,index-3).join('/')},part),' / ']);
                    })),
                    html.table({'class':'file-list'},[html.tr({'class':'title'},[
                        html.th(''),
                        html.th('name'),
                        html.th('ext'),
                        html.th(''),
                        html.th('size'),
                        html.th('date'),
                    ])].concat(locals.fileList.map(function(fileInfo,index){
                        var href=locals.directory+'/'+fileInfo.name;
                        var fileNameClass;
                        var fileNameContent;
                        var fileStat=fileInfo.stat||{};
                        fileStat.isDir=fileStat.isDirectory && fileStat.isDirectory();
                        var realFilename=Path.join(locals.path,fileInfo.name);
                        var ext=Path.extname(realFilename);
                        console.log('xxxxxxxxxxxx ext',ext);
                        if(ext.substr(1) in be.config.turbo.translate){
                            var newExt = '.'+be.config.turbo.translate[ext.substr(1)];
                            var rep = path => path.replace(new RegExp(ext+'$'),newExt)
                            fileStat.translate=!fs.existsSync(rep(realFilename)) && rep(href);
                        }
                        if(fileStat.isDir){
                            fileNameClass='dir-name';
                            fileNameContent=fileInfo.name;
                        }else{
                            fileNameClass='name';
                            fileNameContent=[
                                html.span(Path.basename(fileInfo.name,Path.extname(fileInfo.name))),
                                html.span({'class':'ext-name'},Path.extname(fileInfo.name))
                            ];
                        }
                        return html.tr([
                            html.td({'class':'icon'},fileInfo.name==='..'?'\uD83D\uDCC2':(fileStat.isDir?'\uD83D\uDCC1':'\u274f')),
                            //html.td({'class':'icon'},fileInfo.name==='..'?'\u2711':(fileStat.isDir?'\u274d':'\u274f')),
                            // html.td({'class':'icon'},fileInfo.name==='..'?'D':(fileStat.isDir?'d':'-')),
                            html.td({'class':fileNameClass},[html.a({href:href},fileNameContent)]),
                            (fileStat.isDir?
                                html.td({'class':'ext-dir',colspan:2},[html.a({href:href},'<DIR>')]):
                                html.td({'class':'ext'},[html.a({href:href},Path.extname(fileInfo.name))])
                            ),
                            (newExt?(fileStat.translate?
                                html.td({class:'trans'},[html.a({href:fileStat.translate},newExt)])
                                :html.td({class:'trans-dup'},newExt)
                            ):html.td()),
                            (fileStat.isDir?null:
                                html.td({'class':'size'},fileStat.size?numeral(fileStat.size).format():'')
                            ),
                            html.td({'class':'date'},fileStat.mtime?moment(fileStat.mtime).format('DD/MM/YYYY HH:mm:ss'):''),
                        ]);
                    })))
                ]);
                var result=html.html([
                    html.head([
                        html.meta({charset:'utf8'}),
                        html.title(locals.directory+' - turbo-server'),
                        html.link({rel:"stylesheet", type:"text/css", href:"/dir.css"}),
                        html.link({rel:"shortcut icon", href:pathToRoot+"/img/favicon.png", type:"image/png"}),
                        html.link({rel:"apple-touch-icon", href:pathToRoot+"/img/favicon.png"})
                    ]),
                    html.body([content/*,html.script({src:"/auto-dir-info.js"})*/])
                ]);
                done(null, result.toHtmlText({pretty:true}));
            }
        };
        var optsGenericForFilesUnlogged=changing(be.optsGenericForFiles(),be.config.turbo['serve-content']||{});
        if(be.config.turbo.paths){
            likeAr(be.config.turbo.paths).forEach(function(fsPath, urlPath){
                var urlPath = Path.posix.join(baseUrl, urlPath);
                // console.log('----------- turbing',urlPath,fsPath);
                mainApp.use(urlPath,serveIndex(fsPath, serveIndexConf));
                mainApp.use(urlPath,serveContent(fsPath,optsGenericForFilesUnlogged));
            });
        }
        super.addUnloggedServices(mainApp, baseUrl);
    }
}

new AppTurboServer().start();